require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const axios = require('./.gitignore/node_modules/axios/index.d.cts');

const app = express();
const port = process.env.PORT || 5000;

// PostgreSQL connection setup
const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

// ✅ Check database connection on startup
pool.query("SELECT NOW()", (err, res) => {
    if (err) {
        console.error("❌ Database connection failed:", err);
    } else {
        console.log("✅ Connected to PostgreSQL database at:", res.rows[0].now);
    }
});

// Middleware
app.use(cors());
app.use(express.json());

// Route to fetch weather data
app.get('/weather/:city', async (req, res) => {
    const { city } = req.params;
    const API_KEY = process.env.WEATHER_API_KEY;

    try {
        // Fetch data from OpenWeatherMap API
        const response = await axios.get(`https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${API_KEY}&units=metric`);
        const data = response.data;

        // Extract relevant weather details
        const weatherInfo = {
            city: data.name,
            temperature: data.main.temp,
            humidity: data.main.humidity,
            wind_speed: data.wind.speed,
            weather_description: data.weather[0].description
        };

        // Generate recommendations based on weather conditions
        let recommendation = "";
        if (weatherInfo.weather_description.includes("rain")) {
            recommendation = "☔ Carry an umbrella and wear waterproof clothing.";
        } else if (weatherInfo.weather_description.includes("clear")) {
            recommendation = "😎 Wear sunglasses and apply sunscreen.";
        } else if (weatherInfo.weather_description.includes("snow")) {
            recommendation = "❄️ Wear warm layers and be cautious of slippery roads.";
        } else if (weatherInfo.weather_description.includes("storm")) {
            recommendation = "🌩️ Stay indoors if possible and avoid open areas.";
        } else if (weatherInfo.weather_description.includes("fog")) {
            recommendation = "🌫️ Drive carefully with low beams on.";
        } else if (weatherInfo.weather_description.includes("cloud")) {
            recommendation = "☁️ It might be a gloomy day, but a good time for outdoor walks.";
        }

        weatherInfo.recommendation = recommendation;

        // Store weather data in PostgreSQL
        const query = `
            INSERT INTO weather_data (temperature, humidity, wind_speed, weather_description, api_data_source, recommendation) 
            VALUES ($1, $2, $3, $4, 'OpenWeatherMap', $5) RETURNING *`;
        const values = [weatherInfo.temperature, weatherInfo.humidity, weatherInfo.wind_speed, weatherInfo.weather_description, recommendation];
        await pool.query(query, values);

        res.json(weatherInfo);
    } catch (error) {
        console.error("❌ Error fetching weather data:", error);
        res.status(500).json({ error: 'Error fetching weather data' });
    }
});

// Start the server
app.listen(port, () => {
    console.log("🚀 Server running on http://localhost:" + port);
});
