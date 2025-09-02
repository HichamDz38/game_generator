# Use an official lightweight Python image as the base
FROM python:3.9-slim

# Set environment variables to prevent Python from writing .pyc files and to unbuffer stdout/stderr
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Set the working directory inside the container
WORKDIR /app

RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements file
COPY requirements.txt /app/requirements.txt

# Install Python dependencies
RUN pip install --no-cache-dir --upgrade -r /app/requirements.txt

# Copy the entire application code into the container
COPY ./server.py /app/server.py

# Expose the port
EXPOSE 65432

# Command to run the Flask application when the container starts
CMD ["python", "server.py"]