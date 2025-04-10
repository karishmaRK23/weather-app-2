require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 5000;

// PostgreSQL connection setup
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // Uncomment and use this fallback config if DATABASE_URL is not working correctly:
    /*
    user: process.env.PGUSER || 'postgres',
    host: process.env.PGHOST || 'localhost',
    database: process.env.PGDATABASE || 'weatherdb',
    password: process.env.PGPASSWORD || 'yourpassword',
    port: process.env.PGPORT || 5432,
    */
});

// ✅ Check database connection, name, schema, and list available tables
(async () => {
    try {
        const timeRes = await pool.query("SELECT NOW()");
        console.log("✅ Connected to PostgreSQL at:", timeRes.rows[0].now);

        const dbRes = await pool.query("SELECT current_database()");
        console.log("📦 Current Database:", dbRes.rows[0].current_database);

        const schemaRes = await pool.query("SELECT current_schema()");
        console.log("📁 Current Schema:", schemaRes.rows[0].current_schema);

        const tablesRes = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'`);
        console.log("📋 Tables in public schema:", tablesRes.rows.map(r => r.table_name));
    } catch (err) {
        console.error("❌ Database check failed:", err);
    }
})();

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
        const values = [
            weatherInfo.temperature,
            weatherInfo.humidity,
            weatherInfo.wind_speed,
            weatherInfo.weather_description,
            recommendation
        ];

        await pool.query(query, values);
        res.json(weatherInfo);
    } catch (error) {
        console.error("❌ Error fetching weather data:", error.message);
        res.status(500).json({ error: 'Error fetching weather data' });
    }
});

// Route to fetch weather history
app.get('/weather/history', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM weather_data ORDER BY created_at DESC LIMIT 10');
        res.json(result.rows);
    } catch (error) {
        console.error("❌ Error fetching history:", error.message);
        res.status(500).json({ error: 'Error fetching weather history' });
    }
});

// Start the server
app.listen(port, () => {
    console.log("🚀 Server running on http://localhost:" + port);
});
