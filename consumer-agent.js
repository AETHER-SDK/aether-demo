// Agent B

const express = require('express');
const axios = require('axios');
const OpenAI = require('openai');
require('dotenv').config();

class ConversationalAgent {
    constructor(port = 4000, weatherAgentURL = 'http://localhost:3000', openaiApiKey) {
        this.port = port;
        this.weatherAgentURL = weatherAgentURL;
        this.openai = new OpenAI({ apiKey: openaiApiKey });
        this.app = express();
        this.app.use(express.json());
        this.conversationHistory = {};
    }

    log(message, data = null) {
        const timestamp = new Date().toISOString();
        console.log(`[Agent B - ${timestamp}] ${message}`);
        if (data) console.log(data);
    }

    async requestWeatherData(city) {
        this.log(`Requesting weather data for ${city} from Agent A`);
        try {
            const response = await axios.get(`${this.weatherAgentURL}/weather`, {
                params: { city },
                timeout: 15000
            });
            this.log(`Received weather data for ${city}`);
            return response.data;
        } catch (error) {
            this.log(`Failed to get weather data: ${error.message}`);
            return null;
        }
    }

    async callOpenAI(userMessage, weatherContext = null, history = []) {
        const systemPrompt = `You are a helpful weather assistant. You can provide weather information and engage in conversation.
${weatherContext ? `\n\nCurrent weather data available:\n${JSON.stringify(weatherContext, null, 2)}` : ''}

If the user asks about weather in a specific city and you don't have the data, respond with exactly: "NEED_WEATHER:CityName"
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
            } else {
                aiResponse = `I couldn't retrieve weather data for ${city}. The weather service might be unavailable.`;
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

        this.app.get('/health', (req, res) => {
            res.json({ 
                agent: 'Conversational Agent B',
                status: 'ok',
                weatherAgent: this.weatherAgentURL,
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
            this.log(`Conversational Agent started on port ${this.port}`);
            this.log(`Connected to Weather Agent at ${this.weatherAgentURL}`);
        });
    }
}

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
    console.error('Error: OPENAI_API_KEY environment variable is required');
    console.error('Usage: OPENAI_API_KEY=your_key node agent-b.js');
    process.exit(1);
}

const conversationalAgent = new ConversationalAgent(4000, 'http://localhost:3000', OPENAI_API_KEY);
conversationalAgent.start();