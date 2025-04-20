DROP TABLE IF EXISTS Users CASCADE;
CREATE TABLE IF NOT EXISTS Users (
  user_id SERIAL PRIMARY KEY NOT NULL,
  rewards_total INT,
  username VARCHAR(60) NOT NULL,
  email VARCHAR(60) NOT NULL,
  password_hashed VARCHAR(60) NOT NULL
);

DROP TABLE IF EXISTS Tasks CASCADE;
CREATE TABLE IF NOT EXISTS Tasks (
  task_id SERIAL PRIMARY KEY NOT NULL,
  title VARCHAR(100),
  description VARCHAR(200),
  rewards INT,
  priority INT,
  due_date TIMESTAMP,
  user_id INT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES Users (user_id) ON DELETE CASCADE
);

DROP TABLE IF EXISTS Completed CASCADE;
CREATE TABLE IF NOT EXISTS Completed (
  completed_task_id SERIAL PRIMARY KEY NOT NULL,
  title VARCHAR(100),
  description VARCHAR(200),
  rewards INT,
  priority INT,
  due_date TIMESTAMP,
  user_id INT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES Users (user_id) ON DELETE CASCADE
);