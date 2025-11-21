// Agent A - Weather Data Provider with Aether x402
const express = require('express');
const axios = require('axios');
const OpenAI = require('openai');
const { X402FacilitatorServer } = require('aether-agent-sdk');
require('dotenv').config();

class WeatherAgent {
    constructor(port = 3000) {
        this.port = port;
        this.app = express();
        this.app.use(express.json());
        this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        this.x402Facilitator = new X402FacilitatorServer();
        
        // Weather service price in USDC
        this.WEATHER_PRICE_USDC = parseFloat(process.env.WEATHER_PRICE_USDC || '0.10');
    }

    log(message, data = null) {
        const timestamp = new Date().toISOString();
        console.log(`[Agent A - ${timestamp}] ${message}`);
        if (data) console.log(data);
    }

    async callOpenAI(prompt, context = null) {
        try {
            const messages = [
                { 
                    role: 'system', 
                    content: `You are a weather data specialist agent. Your job is to extract city names from user requests and provide weather information.
${context ? `\n\nAvailable data:\n${JSON.stringify(context, null, 2)}` : ''}

If you need to extract a city name from a request, respond with JSON: {"action": "extract_city", "city": "CityName"}
If you have weather data to present, respond with JSON: {"action": "present_weather", "analysis": "your analysis here"}`
                },
                { role: 'user', content: prompt }
            ];

            const completion = await this.openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: messages,
                response_format: { type: "json_object" }
            });

            return JSON.parse(completion.choices[0].message.content);
        } catch (error) {
            this.log(`OpenAI error: ${error.message}`);
            return null;
        }
    }

    async geocodeCity(city) {
        const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`;
        this.log(`Geocoding: ${city}`);

        try {
            const response = await axios.get(geoUrl, {
                timeout: 10000,
                headers: { 'User-Agent': 'WeatherAgent/1.0' }
            });

            if (!response.data.results || response.data.results.length === 0) {
                throw new Error(`City "${city}" not found`);
            }

            const place = response.data.results[0];
            return {
                lat: place.latitude,
                lon: place.longitude,
                name: place.name,
                country: place.country
            };
        } catch (error) {
            this.log('Geocoding error', error.message);
            throw new Error(`Geocoding failed: ${error.message}`);
        }
    }

    async fetchWeather(lat, lon) {
        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=temperature_2m,precipitation_probability,windspeed_10m`;
        this.log(`Fetching weather: ${lat}, ${lon}`);

        try {
            const response = await axios.get(weatherUrl, {
                timeout: 10000,
                headers: { 'User-Agent': 'WeatherAgent/1.0' }
            });
            return response.data;
        } catch (error) {
            this.log('Weather error', error.message);
            throw new Error(`Weather fetch failed: ${error.message}`);
        }
    }

    // Generate x402 header to request payment
    generate402Header(city) {
        // Convert SOLANA_NETWORK (.env) to x402 format
        const solanaNetwork = process.env.SOLANA_NETWORK || 'devnet';
        const x402Network = solanaNetwork === 'mainnet-beta' ? 'solana-mainnet' : 'solana-devnet';

        const requirements = {
            scheme: 'exact',
            network: x402Network,
            asset: process.env.USDC_MINT,
            payTo: process.env.AGENT_WALLET_ADDRESS,
            maxAmountRequired: (this.WEATHER_PRICE_USDC * 1_000_000).toString(), // Convert to microUSDC
            maxTimeoutSeconds: 300,
            metadata: {
                service: 'weather-data',
                city: city,
                timestamp: new Date().toISOString()
            }
        };

        return {
            requirements,
            paymentHeader: `x402-1.0 ${Buffer.from(JSON.stringify(requirements)).toString('base64')}`
        };
    }

    start() {
        // Endpoint to check supported payment schemes
        this.app.get('/payment-schemes', (req, res) => {
            const schemes = this.x402Facilitator.getSupportedSchemes();
            res.json(schemes);
        });

        // Main endpoint with x402 protection
        this.app.get('/weather', async (req, res) => {
            this.log(`Request from ${req.ip} - city: ${req.query.city || 'none'}`);

            try {
                let city = req.query.city;
                const paymentHeader = req.headers['x-payment-header'];
                
                if (!city) {
                    return res.status(400).json({ 
                        error: "Provide ?city=NAME" 
                    });
                }

                // AI extraction of city name
                const aiExtraction = await this.callOpenAI(`Extract the city name from this request: ${city}`);
                if (aiExtraction && aiExtraction.action === 'extract_city') {
                    city = aiExtraction.city;
                    this.log(`AI extracted city: ${city}`);
                }

                // If no payment header, return 402 Payment Required
                if (!paymentHeader) {
                    const { requirements, paymentHeader: header } = this.generate402Header(city);
                    
                    this.log(`Payment required for ${city} - ${this.WEATHER_PRICE_USDC} USDC`);
                    
                    return res.status(402).json({
                        error: 'Payment Required',
                        message: `This weather data costs ${this.WEATHER_PRICE_USDC} USDC`,
                        paymentHeader: header,
                        requirements: requirements,
                        price: {
                            amount: this.WEATHER_PRICE_USDC,
                            currency: 'USDC',
                            network: requirements.network
                        }
                    });
                }

                // Verify payment with x402
                this.log('Verifying payment...');
                const { requirements } = this.generate402Header(city);
                
                const verification = await this.x402Facilitator.verify(
                    paymentHeader,
                    requirements
                );

                if (!verification.isValid) {
                    this.log('Payment verification failed', verification);
                    return res.status(402).json({
                        error: 'Invalid Payment',
                        message: verification.reason || 'Payment verification failed',
                        requirements: requirements
                    });
                }

                // Execute payment settlement
                this.log('Settling payment...');
                const settlement = await this.x402Facilitator.settle(
                    paymentHeader,
                    requirements
                );

                if (!settlement.success) {
                    this.log('Payment settlement failed', settlement);
                    return res.status(402).json({
                        error: 'Settlement Failed',
                        message: settlement.error || 'Payment settlement failed'
                    });
                }

                this.log(`Payment received! TX: ${settlement.txHash}`);

                // Payment validated - provide weather data
                const cityInfo = await this.geocodeCity(city);
                const weatherData = await this.fetchWeather(cityInfo.lat, cityInfo.lon);

                const aiAnalysis = await this.callOpenAI(
                    `Provide a brief weather analysis for ${cityInfo.name}`,
                    {
                        location: `${cityInfo.name}, ${cityInfo.country}`,
                        current: weatherData.current_weather,
                        forecast: {
                            next_hours: weatherData.hourly.temperature_2m.slice(0, 6),
                            precipitation: weatherData.hourly.precipitation_probability.slice(0, 6)
                        }
                    }
                );

                const result = {
                    location: `${cityInfo.name}, ${cityInfo.country}`,
                    coordinates: { lat: cityInfo.lat, lon: cityInfo.lon },
                    weather: weatherData.current_weather,
                    analysis: aiAnalysis?.analysis || 'No analysis available',
                    payment: {
                        verified: true,
                        txHash: settlement.txHash,
                        amount: this.WEATHER_PRICE_USDC,
                        currency: 'USDC'
                    },
                    timestamp: new Date().toISOString()
                };

                this.log('Response: 200 OK with weather data');
                res.json(result);

            } catch (err) {
                this.log(`ERROR: ${err.message}`);
                res.status(500).json({ 
                    error: err.message
                });
            }
        });

        this.app.get('/health', (req, res) => {
            res.json({ 
                agent: 'Weather Agent A (AI-Powered + x402)',
                status: 'ok',
                pricing: {
                    weatherData: `${this.WEATHER_PRICE_USDC} USDC`,
                    network: process.env.SOLANA_NETWORK || 'devnet'
                },
                timestamp: new Date().toISOString() 
            });
        });

        this.app.listen(this.port, () => {
            this.log(`AI Weather Agent with x402 started on port ${this.port}`);
            this.log(`Weather data price: ${this.WEATHER_PRICE_USDC} USDC`);
        });
    }
}

if (!process.env.OPENAI_API_KEY) {
    console.error('Error: OPENAI_API_KEY not found in .env file');
    process.exit(1);
}

if (!process.env.AGENT_WALLET_ADDRESS) {
    console.error('Error: AGENT_WALLET_ADDRESS not found in .env file');
    process.exit(1);
}

const weatherAgent = new WeatherAgent(3000);
weatherAgent.start();