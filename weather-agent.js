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
        
        this.log(`Geocoding city: "${city}"`, { url: geoUrl });

        try {
            const response = await axios.get(geoUrl);
            this.log('Geocoding response received', {
                status: response.status,
                data: response.data
            });

            if (!response.data.results || response.data.results.length === 0) {
                this.log('No results found for city');
                throw new Error(`City "${city}" not found`);
            }

            const place = response.data.results[0];
            const result = {
                lat: place.latitude,
                lon: place.longitude,
                name: place.name,
                country: place.country
            };

            this.log('Coordinates extracted', result);
            return result;

        } catch (error) {
            this.log('Geocoding error', {
                message: error.message,
                response: error.response?.data,
                status: error.response?.status
            });
            throw error;
        }
    }

    async fetchWeather(lat, lon) {
        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`;
        
        this.log('Fetching weather', { 
            lat, 
            lon, 
            url: weatherUrl 
        });

        try {
            const response = await axios.get(weatherUrl);
            this.log('Weather response received', {
                status: response.status,
                data: response.data
            });

            return response.data.current_weather;

        } catch (error) {
            this.log('Weather fetch error', {
                message: error.message,
                response: error.response?.data,
                status: error.response?.status
            });
            throw error;
        }
    }

    start() {
        this.app.get('/weather', async (req, res) => {
            this.log('Request received', {
                query: req.query,
                headers: req.headers
            });

            try {
                let lat = req.query.lat;
                let lon = req.query.lon;
                let cityInfo = null;

                if (req.query.city) {
                    this.log(`Searching for city: ${req.query.city}`);
                    cityInfo = await this.geocodeCity(req.query.city);
                    lat = cityInfo.lat;
                    lon = cityInfo.lon;
                }

                if (!lat || !lon) {
                    this.log('Missing parameters', { lat, lon });
                    return res.status(400).json({ 
                        error: "Provide ?city=NAME or ?lat=XX&lon=YY" 
                    });
                }

                this.log('Fetching weather for coordinates', { lat, lon });
                const weather = await this.fetchWeather(lat, lon);

                const result = {
                    location: cityInfo ? `${cityInfo.name}, ${cityInfo.country}` : "Custom coordinates",
                    coordinates: { lat, lon },
                    weather,
                    timestamp: new Date().toISOString()
                };

                this.log('Response sent', result);
                res.json(result);

            } catch (err) {
                this.log('ERROR 500', {
                    message: err.message,
                    stack: err.stack,
                    response: err.response?.data
                });

                res.status(500).json({ 
                    error: err.message,
                    details: err.response?.data || 'No details available'
                });
            }
        });

        this.app.get('/health', (req, res) => {
            this.log('Health check');
            res.json({ status: 'ok', timestamp: new Date().toISOString() });
        });

        this.app.listen(this.port, () => {
            this.log(`Agent A started on port ${this.port}`);
        });
    }
}

const weatherAgent = new WeatherAgent();
weatherAgent.start();