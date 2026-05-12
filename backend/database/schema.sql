-- Snapcar Tracker MySQL schema

CREATE DATABASE IF NOT EXISTS snapcar_tracker CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE snapcar_tracker;

CREATE TABLE IF NOT EXISTS vendors (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    contact VARCHAR(64) DEFAULT NULL,
    city VARCHAR(80) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bookings (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    vendor_id INT UNSIGNED NOT NULL,
    customer_name VARCHAR(120) NOT NULL,
    booking_date DATE NOT NULL,
    duration_hours INT UNSIGNED NOT NULL DEFAULT 24,
    amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    status ENUM('pending', 'confirmed', 'completed', 'cancelled') NOT NULL DEFAULT 'pending',
    payment_status ENUM('paid', 'pending') NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE
);

INSERT INTO vendors (name, contact, city)
VALUES
  ('Hinjewadi Wheels', '7219475630', 'Pune'),
  ('Baner Drive', '8390185617', 'Pune');

INSERT INTO bookings (vendor_id, customer_name, booking_date, duration_hours, amount, status, payment_status)
VALUES
  (1, 'Aman Shah', CURDATE() - INTERVAL 1 DAY, 24, 1980.00, 'completed', 'paid'),
  (1, 'Pooja Naik', CURDATE() - INTERVAL 1 DAY, 24, 1740.00, 'completed', 'pending'),
  (2, 'Ravi S.', CURDATE() - INTERVAL 3 DAY, 48, 3540.00, 'completed', 'pending'),
  (2, 'Sonal P.', CURDATE() - INTERVAL 5 DAY, 72, 5060.00, 'pending', 'pending');
