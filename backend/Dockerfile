# Use official lightweight Python image
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Copy project files
COPY . .

# Install backend dependencies
RUN pip install -r requirements.txt

# Expose port 5000
EXPOSE 5000

# Command to run your backend app
CMD ["python", "app.py"]
