CREATE TABLE IF NOT EXISTS business_profiles (
  id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  name VARCHAR(191) NOT NULL,
  role VARCHAR(191) NOT NULL,
  address TEXT NOT NULL,
  hours VARCHAR(191) NOT NULL,
  admin_phone VARCHAR(50) NOT NULL,
  current_promo TEXT NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS products (
  id VARCHAR(128) NOT NULL PRIMARY KEY,
  name VARCHAR(191) NOT NULL,
  price INT UNSIGNED NOT NULL DEFAULT 0,
  description TEXT NOT NULL,
  promo TEXT NOT NULL,
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS product_keywords (
  product_id VARCHAR(128) NOT NULL,
  keyword VARCHAR(191) NOT NULL,
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, keyword),
  CONSTRAINT fk_product_keywords_product
    FOREIGN KEY (product_id) REFERENCES products(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS product_media (
  product_id VARCHAR(128) NOT NULL,
  id VARCHAR(128) NOT NULL,
  label VARCHAR(191) NOT NULL,
  type VARCHAR(80) NOT NULL,
  url TEXT NOT NULL,
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (product_id, id),
  CONSTRAINT fk_product_media_product
    FOREIGN KEY (product_id) REFERENCES products(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS leads (
  id INT UNSIGNED NOT NULL PRIMARY KEY,
  name VARCHAR(191) NOT NULL,
  phone VARCHAR(50) NOT NULL UNIQUE,
  interest VARCHAR(191) NOT NULL,
  source VARCHAR(80) NOT NULL,
  status VARCHAR(40) NOT NULL,
  follow_ups_sent JSON NOT NULL,
  notes JSON NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  INDEX idx_leads_status (status),
  INDEX idx_leads_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS conversations (
  phone VARCHAR(50) NOT NULL PRIMARY KEY,
  customer_id VARCHAR(128) NOT NULL,
  name VARCHAR(191) NULL,
  interest VARCHAR(191) NULL,
  source VARCHAR(80) NULL,
  status VARCHAR(40) NOT NULL,
  stage VARCHAR(40) NOT NULL,
  compacted_token_count INT UNSIGNED NOT NULL DEFAULT 0,
  compacted_at DATETIME NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  INDEX idx_conversations_updated_at (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS messages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  phone VARCHAR(50) NOT NULL,
  sender VARCHAR(30) NOT NULL,
  body TEXT NOT NULL,
  created_at DATETIME NOT NULL,
  INDEX idx_messages_phone_created_at (phone, created_at),
  INDEX idx_messages_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS compacted (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  phone VARCHAR(50) NOT NULL,
  customer_id VARCHAR(128) NOT NULL,
  name VARCHAR(191) NULL,
  interest VARCHAR(191) NULL,
  status VARCHAR(40) NOT NULL,
  message_count INT UNSIGNED NOT NULL,
  estimated_tokens INT UNSIGNED NOT NULL,
  summary TEXT NOT NULL,
  created_at DATETIME NOT NULL,
  INDEX idx_compacted_phone_created_at (phone, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
