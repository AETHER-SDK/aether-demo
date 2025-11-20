const axios = require('axios');

class ConsumerAgent {
    constructor(port = 3000, city = 'Paris') {
        this.baseURL = `http://localhost:${port}`;
        this.city = city;
    }

    async getWeather() {
        try {
            const response = await axios.get(`${this.baseURL}/weather`, {
                params: { city: this.city }
            });
            return response.data;
        } catch (error) {
            throw new Error(`Request error: ${error.message}`);
        }
    }

    analyzeWeather(weatherData) {
        const temp = weatherData.weather.temperature;
        const windSpeed = weatherData.weather.windspeed;
        
        if (temp > 25 && windSpeed < 10) {
            return "Hot and calm weather";
        } else if (temp < 10 && windSpeed > 20) {
            return "Cold and windy weather";
        } else if (temp < 0) {
            return "Freezing conditions";
        } else {
            return "Moderate weather conditions";
        }
    }

    async start() {
        try {
            console.log(`Consumer Agent B started - monitoring weather for ${this.city}`);
            
            while (true) {
                const weatherData = await this.getWeather();
                const analysis = this.analyzeWeather(weatherData);
                
                console.log(`\n[${new Date().toISOString()}]`);
                console.log(`Location: ${weatherData.location}`);
                console.log(`Temperature: ${weatherData.weather.temperature}°C`);
                console.log(`Wind: ${weatherData.weather.windspeed} km/h`);
                console.log(`Analysis: ${analysis}`);
                
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        } catch (error) {
            console.error('Error:', error);
        }
    }
}

const consumerAgent = new ConsumerAgent(3000, 'Paris');
consumerAgent.start();