const express = require('express');
const axios = require('axios');
const OpenAI = require('openai');
require('dotenv').config();

class WeatherAgent {
    constructor(port = 3000) {
        this.port = port;
        this.app = express();
        this.app.use(express.json());
        this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
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
        this.log(`Geocoding: ${city}`, { url: geoUrl });

        try {
            const response = await axios.get(geoUrl, {
                timeout: 10000,
                headers: { 'User-Agent': 'WeatherAgent/1.0' }
            });

            this.log('Geocoding response', { 
                status: response.status,
                results: response.data.results?.length || 0 
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
            this.log('Geocoding error', {
                message: error.message,
                code: error.code,
                response: error.response?.data,
                stack: error.stack
            });
            throw new Error(`Geocoding failed: ${error.code || error.message}`);
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

    start() {
        this.app.get('/weather', async (req, res) => {
            this.log(`Request from ${req.ip} - city: ${req.query.city || 'none'}`);

            try {
                let city = req.query.city;
                
                if (!city) {
                    return res.status(400).json({ 
                        error: "Provide ?city=NAME" 
                    });
                }

                const aiExtraction = await this.callOpenAI(`Extract the city name from this request: ${city}`);
                
                if (aiExtraction && aiExtraction.action === 'extract_city') {
                    city = aiExtraction.city;
                    this.log(`AI extracted city: ${city}`);
                }

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
                    timestamp: new Date().toISOString()
                };

                this.log('Response: 200 OK');
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
                agent: 'Weather Agent A (AI-Powered)',
                status: 'ok', 
                timestamp: new Date().toISOString() 
            });
        });

        this.app.listen(this.port, () => {
            this.log(`AI Weather Agent started on port ${this.port}`);
        });
    }
}

if (!process.env.OPENAI_API_KEY) {
    console.error('Error: OPENAI_API_KEY not found in .env file');
    process.exit(1);
}

const weatherAgent = new WeatherAgent(3000);
weatherAgent.start();