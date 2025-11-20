// Agent A
const express = require('express');
const app = express();

class WeatherAgent {
    constructor(port = 3000) {
        this.port = port;
        this.app = app;
    }

    generateWeatherData() {
        return {
            temperature: +(15 + Math.random() * 15).toFixed(1),
            humidity: +(30 + Math.random() * 60).toFixed(1),
            windSpeed: +(Math.random() * 30).toFixed(1),
            timestamp: new Date().toISOString()
        };
    }

    start() {
        this.app.get('/weather', (req, res) => {
            const weatherData = this.generateWeatherData();
            res.json(weatherData);
        });

        this.app.listen(this.port, () => {
            console.log(`Agent A start on port ${this.port}`);
        });
    }
}

const weatherAgent = new WeatherAgent();
weatherAgent.start();