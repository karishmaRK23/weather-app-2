require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const axios = require('axios');
const client = require('prom-client'); // 📊 Prometheus client

const app = express();
const port = process.env.PORT || 5000;

// Prometheus metrics setup
const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics(); // default system metrics

// Custom Counter for HTTP requests
const httpRequestCounter = new client.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'handler', 'status']
});

// Middleware to count requests
app.use((req, res, next) => {
    res.on('finish', () => {
        httpRequestCounter.inc({
            method: req.method,
            handler: req.route ? req.route.path : req.path,
            status: res.statusCode
        });
    });
    next();
});

// Prometheus metrics endpoint
app.get('/metrics', async (req, res) => {
    res.set('Content-Type', client.register.contentType);
    res.end(await client.register.metrics());
});

// PostgreSQL connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

// Check DB status
(async () => {
    try {
        const timeRes = await pool.query("SELECT NOW()");
        console.log("✅ Connected to PostgreSQL at:", timeRes.rows[0].now);

        const dbRes = await pool.query("SELECT current_database()");
        console.log("📦 Current Database:", dbRes.rows[0].current_database);

        const schemaRes = await pool.query("SELECT current_schema()");
        console.log("📁 Current Schema:", schemaRes.rows[0].current_schema);

        const tablesRes = await pool.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`);
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
        const response = await axios.get(`https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${API_KEY}&units=metric`);
        const data = response.data;

        const weatherInfo = {
            city: data.name,
            temperature: data.main.temp,
            humidity: data.main.humidity,
            wind_speed: data.wind.speed,
            weather_description: data.weather[0].description
        };

        // Generate recommendation
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

        // Insert into DB
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

// Route to get weather history
app.get('/weather/history', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM weather_data ORDER BY created_at DESC LIMIT 10');
        res.json(result.rows);
    } catch (error) {
        console.error("❌ Error fetching history:", error.message);
        res.status(500).json({ error: 'Error fetching weather history' });
    }
});

// Start server
app.listen(port, () => {
    console.log("🚀 Server running on http://localhost:" + port);
    console.log("📈 Prometheus metrics available at http://localhost:" + port + "/metrics");
});
