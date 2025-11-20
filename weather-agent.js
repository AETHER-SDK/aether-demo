const express = require('express');
const axios = require('axios');

class WeatherAgent {
    constructor(port = 3000) {
        this.port = port;
        this.app = express();
        this.app.use(express.json());
    }

    log(message, data = null) {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] ${message}`);
        if (data) {
            console.log(data);
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
            const result = {
                lat: place.latitude,
                lon: place.longitude,
                name: place.name,
                country: place.country
            };

            return result;

        } catch (error) {
            const errMsg = error.response?.data || error.message || 'Unknown error';
            this.log('Geocoding error', errMsg);
            throw new Error(`Geocoding failed: ${errMsg}`);
        }
    }

    async fetchWeather(lat, lon) {
        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`;
        
        this.log(`Fetching weather: ${lat}, ${lon}`);

        try {
            const response = await axios.get(weatherUrl);
            return response.data.current_weather;

        } catch (error) {
            this.log('Weather error', error.message);
            throw error;
        }
    }

    start() {
        this.app.get('/weather', async (req, res) => {
            this.log(`GET /weather - city: ${req.query.city || 'none'}, lat: ${req.query.lat || 'none'}, lon: ${req.query.lon || 'none'}`);

            try {
                let lat = req.query.lat;
                let lon = req.query.lon;
                let cityInfo = null;

                if (req.query.city) {
                    cityInfo = await this.geocodeCity(req.query.city);
                    lat = cityInfo.lat;
                    lon = cityInfo.lon;
                }

                if (!lat || !lon) {
                    return res.status(400).json({ 
                        error: "Provide ?city=NAME or ?lat=XX&lon=YY" 
                    });
                }

                const weather = await this.fetchWeather(lat, lon);

                const result = {
                    location: cityInfo ? `${cityInfo.name}, ${cityInfo.country}` : "Custom coordinates",
                    coordinates: { lat, lon },
                    weather,
                    timestamp: new Date().toISOString()
                };

                this.log('Response: 200 OK');
                res.json(result);

            } catch (err) {
                this.log(`ERROR: ${err.message}`);
                res.status(500).json({ 
                    error: err.message,
                    details: err.response?.data || 'No details available'
                });
            }
        });

        this.app.get('/health', (req, res) => {
            res.json({ status: 'ok', timestamp: new Date().toISOString() });
        });

        this.app.listen(this.port, () => {
            this.log(`Agent A started on port ${this.port}`);
        });
    }
}

const weatherAgent = new WeatherAgent();
weatherAgent.start();