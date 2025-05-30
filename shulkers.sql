-- shulker_inventory.sql

CREATE TABLE shulker_inventory (
  id SERIAL PRIMARY KEY,
  shulker_name TEXT NOT NULL,
  x INT NOT NULL,
  y INT NOT NULL,
  z INT NOT NULL,
  slot INT NOT NULL
);
