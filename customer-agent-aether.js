// Agent B - Conversational Agent with Aether Settlement
const express = require('express');
const axios = require('axios');
const OpenAI = require('openai');
const { SettlementAgent } = require('aether-agent-sdk');
require('dotenv').config();

class ConversationalAgent {
    constructor(port = 4000, weatherAgentURL = 'http://localhost:3000', openaiApiKey) {
        this.port = port;
        this.weatherAgentURL = weatherAgentURL;
        this.openai = new OpenAI({ apiKey: openaiApiKey });
        this.settlementAgent = null;
        this.app = express();
        this.app.use(express.json());
        this.conversationHistory = {};
        this.paymentCache = {}; // Recent payments cache
    }

    log(message, data = null) {
        const timestamp = new Date().toISOString();
        console.log(`[Agent B - ${timestamp}] ${message}`);
        if (data) console.log(data);
    }

    async initialize() {
        try {
            this.log('Initializing Settlement Agent...');

            // Agent B must use its own wallet (AGENT_B_PRIVATE_KEY)
            // Temporarily override AGENT_PRIVATE_KEY for SettlementAgent
            const originalAgentKey = process.env.AGENT_PRIVATE_KEY;
            if (process.env.AGENT_B_PRIVATE_KEY) {
                process.env.AGENT_PRIVATE_KEY = process.env.AGENT_B_PRIVATE_KEY;
                this.log('Using Agent B wallet for payments');
            }

            this.settlementAgent = new SettlementAgent();
            await this.settlementAgent.init();

            // Restore original key
            process.env.AGENT_PRIVATE_KEY = originalAgentKey;

            this.log('Settlement Agent initialized successfully');
        } catch (error) {
            this.log(`Failed to initialize Settlement Agent: ${error.message}`);
            throw error;
        }
    }

    async requestWeatherData(city) {
        this.log(`Requesting weather data for ${city} from Agent A`);
        
        try {
            // First request without payment to get requirements
            let response;
            try {
                response = await axios.get(`${this.weatherAgentURL}/weather`, {
                    params: { city },
                    timeout: 15000
                });
                
                // If we get a direct response (no payment required)
                this.log(`Received free weather data for ${city}`);
                return response.data;
                
            } catch (error) {
                // If 402 error, extract payment requirements
                if (error.response && error.response.status === 402) {
                    const paymentInfo = error.response.data;
                    this.log(`Payment required: ${paymentInfo.price.amount} ${paymentInfo.price.currency}`);
                    
                    // Check if we've already paid recently for this city
                    if (this.paymentCache[city] &&
                        Date.now() - this.paymentCache[city].timestamp < 60000) {
                        this.log(`Using cached payment for ${city}`);
                        return this.paymentCache[city].data;
                    }

                    // Create signed x402 transaction (standard protocol)
                    this.log('Creating signed x402 payment...');
                    const paymentHeader = await this.settlementAgent.createSignedPayment(
                        paymentInfo.requirements.payTo,
                        paymentInfo.price.amount
                    );

                    this.log('Sending payment to Agent A for verification and submission...');
                    response = await axios.get(`${this.weatherAgentURL}/weather`, {
                        params: { city },
                        headers: {
                            'X-Payment-Header': paymentHeader
                        },
                        timeout: 15000
                    });

                    // Cache the result (Agent A executed the transfer)
                    this.paymentCache[city] = {
                        data: response.data,
                        timestamp: Date.now(),
                        txHash: response.data.payment?.txHash || 'unknown'
                    };

                    if (response.data.payment?.txHash) {
                        this.log(`Payment successful! TX: ${response.data.payment.txHash.substring(0, 16)}...`);
                    }

                    this.log(`Successfully purchased weather data for ${city}`);
                    return response.data;
                    
                } else {
                    throw error;
                }
            }
            
        } catch (error) {
            this.log(`Failed to get weather data: ${error.message}`);
            if (error.response) {
                this.log('Error response:', error.response.data);
            }
            return null;
        }
    }

    async callOpenAI(userMessage, weatherContext = null, history = []) {
        const systemPrompt = `You are a helpful weather assistant with payment capabilities. You can purchase weather information on behalf of users.
${weatherContext ? `\n\nCurrent weather data (purchased):\n${JSON.stringify(weatherContext, null, 2)}` : ''}

If the user asks about weather in a specific city and you don't have the data, respond with exactly: "NEED_WEATHER:CityName"
If weather data includes payment information, acknowledge the transaction naturally.
Otherwise, engage naturally in conversation using any available weather data.`;

        try {
            const messages = [
                { role: 'system', content: systemPrompt },
                ...history,
                { role: 'user', content: userMessage }
            ];

            const completion = await this.openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: messages.slice(-10)
            });

            return completion.choices[0].message.content;
        } catch (error) {
            this.log(`OpenAI API error: ${error.message}`);
            return "Sorry, I'm having trouble processing that right now.";
        }
    }

    async processMessage(sessionId, userMessage) {
        if (!this.conversationHistory[sessionId]) {
            this.conversationHistory[sessionId] = [];
        }

        const history = this.conversationHistory[sessionId];
        let aiResponse = await this.callOpenAI(userMessage, null, history);

        if (aiResponse.startsWith('NEED_WEATHER:')) {
            const city = aiResponse.split(':')[1].trim();
            this.log(`OpenAI requested weather data for: ${city}`);
            
            const weatherData = await this.requestWeatherData(city);
            
            if (weatherData) {
                aiResponse = await this.callOpenAI(userMessage, weatherData, history);
                
                // Add payment info if available
                if (weatherData.payment) {
                    aiResponse += `\n\n💰 Payment processed: ${weatherData.payment.amount} ${weatherData.payment.currency} (TX: ${weatherData.payment.txHash.substring(0, 8)}...)`;
                }
            } else {
                aiResponse = `I couldn't retrieve weather data for ${city}. The weather service might be unavailable or I may not have sufficient funds.`;
            }
        }

        history.push({ role: 'user', content: userMessage });
        history.push({ role: 'assistant', content: aiResponse });

        if (history.length > 20) {
            this.conversationHistory[sessionId] = history.slice(-20);
        }

        return aiResponse;
    }

    start() {
        this.app.post('/chat', async (req, res) => {
            const { message, sessionId = 'default' } = req.body;

            if (!message) {
                return res.status(400).json({ error: 'Message is required' });
            }

            this.log(`Chat request from session: ${sessionId}`);

            try {
                const response = await this.processMessage(sessionId, message);
                res.json({ 
                    response,
                    sessionId,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                this.log(`Error processing message: ${error.message}`);
                res.status(500).json({ error: error.message });
            }
        });

        this.app.get('/balance', async (req, res) => {
            try {
                // Note: Implement balance retrieval from Solana
                res.json({
                    message: 'Balance check not yet implemented',
                    network: process.env.SOLANA_NETWORK || 'devnet'
                });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        this.app.get('/payment-history', (req, res) => {
            const history = Object.entries(this.paymentCache).map(([city, data]) => ({
                city,
                amount: data.data?.payment?.amount,
                currency: data.data?.payment?.currency,
                txHash: data.txHash,
                timestamp: new Date(data.timestamp).toISOString()
            }));
            
            res.json({ payments: history });
        });

        this.app.get('/health', (req, res) => {
            res.json({ 
                agent: 'Conversational Agent B (x402 Payment Client)',
                status: 'ok',
                settlementAgent: this.settlementAgent ? 'initialized' : 'not initialized',
                weatherAgent: this.weatherAgentURL,
                paymentsProcessed: Object.keys(this.paymentCache).length,
                timestamp: new Date().toISOString() 
            });
        });

        this.app.delete('/session/:sessionId', (req, res) => {
            const { sessionId } = req.params;
            delete this.conversationHistory[sessionId];
            this.log(`Session ${sessionId} cleared`);
            res.json({ message: 'Session cleared' });
        });

        this.app.listen(this.port, () => {
            this.log(`Conversational Agent with x402 Payment started on port ${this.port}`);
            this.log(`Connected to Weather Agent at ${this.weatherAgentURL}`);
        });
    }
}

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
    console.error('Error: OPENAI_API_KEY environment variable is required');
    process.exit(1);
}

async function main() {
    const conversationalAgent = new ConversationalAgent(
        4000, 
        'http://localhost:3000', 
        OPENAI_API_KEY
    );
    
    try {
        await conversationalAgent.initialize();
        conversationalAgent.start();
    } catch (error) {
        console.error('Failed to start agent:', error);
        process.exit(1);
    }
}

main();