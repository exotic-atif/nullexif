# -----------------------------------------------------------------------------
# Stage 1: Build Frontend Assets with Node
# -----------------------------------------------------------------------------
FROM node:20-alpine AS frontend-builder

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy source files and compile Vite/TypeScript bundle
COPY tsconfig.json vite.config.ts ./
COPY src/ ./src/
RUN npm run build

# -----------------------------------------------------------------------------
# Stage 2: PHP + Apache Web Server with ExifTool, GD, and Python
# -----------------------------------------------------------------------------
FROM php:8.2-apache

# Install system dependencies: ExifTool, GD image libraries, and Python
RUN apt-get update && apt-get install -y --no-install-recommends \
    libimage-exiftool-perl \
    libpng-dev \
    libjpeg-dev \
    libwebp-dev \
    libfreetype6-dev \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Configure and compile PHP GD extension with full format support
RUN docker-php-ext-configure gd --with-freetype --with-jpeg --with-webp \
    && docker-php-ext-install -j$(nproc) gd

# Enable necessary Apache modules
RUN a2enmod rewrite headers

# Configure PHP settings for photo uploading, memory, and sessions
RUN { \
    echo 'upload_max_filesize = 128M'; \
    echo 'post_max_size = 128M'; \
    echo 'memory_limit = 256M'; \
    echo 'max_execution_time = 300'; \
    echo 'max_input_time = 300'; \
    echo 'session.cookie_httponly = 1'; \
    echo 'session.use_only_cookies = 1'; \
} > /usr/local/etc/php/conf.d/nullexif.ini

# Set DirectoryIndex to prioritize index.html
RUN echo "DirectoryIndex index.html index.php" >> /etc/apache2/apache2.conf

WORKDIR /var/www/html

# Copy application source code
COPY . .

# Copy production bundle from frontend-builder stage
COPY --from=frontend-builder /app/dist ./dist

# Create uploads directory and set write permissions for Apache
RUN mkdir -p /var/www/html/uploads \
    && chown -R www-data:www-data /var/www/html/uploads \
    && chmod -R 775 /var/www/html/uploads

# Support Render dynamic $PORT (default to 80 if not set)
EXPOSE 80 10000

CMD ["sh", "-c", "PORT=${PORT:-80}; sed -i \"s/Listen 80/Listen ${PORT}/g\" /etc/apache2/ports.conf && sed -i \"s/:80>/:${PORT}>/g\" /etc/apache2/sites-available/000-default.conf && apache2-foreground"]
