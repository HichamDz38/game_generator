# Use an official lightweight Python image as the base
FROM python:3.9-slim-buster

# Set environment variables to prevent Python from writing .pyc files and to unbuffer stdout/stderr
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Set the working directory inside the container
WORKDIR /app

# Copy the entire application code into the container
COPY generic_device.py /app/generic_device.py


# Command to run the Flask application when the container starts
CMD ["python", "generic_device.py"]