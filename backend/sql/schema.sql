CREATE TABLE IF NOT EXISTS orders (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id VARCHAR(64) NOT NULL UNIQUE,
  outlet_id VARCHAR(64) NOT NULL,
  outlet_name VARCHAR(255) NOT NULL,
  outlet_address VARCHAR(255) NOT NULL,
  outlet_phone VARCHAR(32) NOT NULL,
  order_type ENUM('takeaway', 'delivery', 'dinein') NOT NULL,
  total DECIMAL(10, 2) NOT NULL,
  delivery_fee DECIMAL(10, 2) NOT NULL,
  distance_km DECIMAL(10, 2) NULL,
  customer_location_url TEXT NOT NULL,
  created_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS order_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_row_id BIGINT UNSIGNED NOT NULL,
  menu_item_id VARCHAR(64) NOT NULL,
  item_name VARCHAR(255) NOT NULL,
  selected_size VARCHAR(64) NULL,
  quantity INT NOT NULL,
  base_price DECIMAL(10, 2) NOT NULL,
  discounted_price DECIMAL(10, 2) NOT NULL,
  total_price DECIMAL(10, 2) NOT NULL,
  applied_offer_id VARCHAR(64) NULL,
  applied_offer_title VARCHAR(255) NULL,
  is_offer_bonus TINYINT(1) NOT NULL DEFAULT 0,
  CONSTRAINT fk_order_items_order
    FOREIGN KEY (order_row_id) REFERENCES orders(id)
    ON DELETE CASCADE
);
