INSERT INTO users (rewards_total, username, email, password_hashed) 
VALUES (0,'samuelharris', 'samuelharris@somewhere.com', '$2a$10$QqQF7nK0lyqzBQzu8qo2AOMM2b/djPXm13DKxuFYXIecKkZ93oh8q');

INSERT INTO users (rewards_total, username, email, password_hashed) 
VALUES (0,'brucefilippone', 'brucefilippone@somewhere.com', '$2a$10$QqQF7nK0lyqzBQzu8qo2AOMM2b/djPXm13DKxuFYXIecKkZ93oh8q');

INSERT INTO users (rewards_total, username, email, password_hashed) 
VALUES (0,'elijahjaeger', 'elijahjaeger@somewhere.com', '$2a$10$QqQF7nK0lyqzBQzu8qo2AOMM2b/djPXm13DKxuFYXIecKkZ93oh8q');

INSERT INTO users (rewards_total, username, email, password_hashed) 
VALUES (0,'jackryan', 'jackryan@somewhere.com', '$2a$10$QqQF7nK0lyqzBQzu8qo2AOMM2b/djPXm13DKxuFYXIecKkZ93oh8q');

INSERT INTO users (rewards_total, username, email, password_hashed) 
VALUES (0,'shonadoyle', 'shonadoyle@gmail.com', '$2a$10$QqQF7nK0lyqzBQzu8qo2AOMM2b/djPXm13DKxuFYXIecKkZ93oh8q');

INSERT INTO tasks (title, description, rewards, priority, due_date, user_id)   
VALUES ('Task1', 'Description for task 1',1,2,'2025-05-15 15:00:00',(SELECT user_id FROM users WHERE username = 'samuelharris'));

INSERT INTO tasks (title, description, rewards, priority, due_date, user_id)   
VALUES ('Task2', 'Description for task 2',2,2,'2025-04-30 12:30:00',(SELECT user_id FROM users WHERE username = 'samuelharris'));
INSERT INTO users (rewards_total, username, email, password_hashed) 
VALUES (5,'user_test_3', 'test_email_3@gmail.com', 'test_password_3');

INSERT INTO users (rewards_total, username, email, password_hashed) 
VALUES (6,'user_test_4', 'test_email_4@gmail.com', 'test_password_4');

INSERT INTO users (rewards_total, username, email, password_hashed) 
VALUES (7,'user_test_5', 'test_email_5@gmail.com', 'test_password_5');

INSERT INTO tasks (title, description, rewards, priority, due_date, user_id)   
VALUES ('Task3', 'Description for task 3',3,2,'2025-04-29 12:30:00',(SELECT user_id FROM users WHERE username = 'samuelharris'));

INSERT INTO tasks (title, description, rewards, priority, due_date, user_id)   
VALUES ('Task4', 'Description for task 4',4,2,'2025-04-30 12:30:00',(SELECT user_id FROM users WHERE username = 'samuelharris'));


INSERT INTO tasks (title, description, rewards, priority, due_date, user_id)
VALUES ('Task5', 'Description for task 5',1,2,'2025-05-12 14:30:00',(SELECT user_id FROM users WHERE username = 'brucefilippone'));

INSERT INTO tasks (title, description, rewards, priority, due_date, user_id)
VALUES ('Task6', 'Description for task 6',1,2,'2025-04-28 14:30:00',(SELECT user_id FROM users WHERE username = 'elijahjaeger'));

INSERT INTO tasks (title, description, rewards, priority, due_date, user_id)
VALUES ('Task7', 'Description for task 7',1,2,'2025-04-25 14:30:00',(SELECT user_id FROM users WHERE username = 'jackryan'));


INSERT INTO tasks (title, description, rewards, priority, due_date, user_id)
VALUES ('Laundry', 'Do the laundry',10,2,'2025-04-12 14:30:00',(SELECT user_id FROM users WHERE username = 'shonadoyle'));

INSERT INTO tasks (title, description, rewards, priority, due_date, user_id)
VALUES ('Dishes', 'Do the dishes',10,2,'2025-04-29 14:30:00',(SELECT user_id FROM users WHERE username = 'shonadoyle'));

INSERT INTO tasks (title, description, rewards, priority, due_date, user_id)
VALUES ('Food shopping', 'Go to Trader Joes',10,3,'2025-04-30 16:31:00',(SELECT user_id FROM users WHERE username = 'shonadoyle'));

INSERT INTO tasks (title, description, rewards, priority, due_date, user_id)
VALUES ('Doctor appointment', 'Go see the doctor',10,2,'2025-05-02 12:31:00',(SELECT user_id FROM users WHERE username = 'shonadoyle'));


INSERT INTO tasks (title, description, rewards, priority, due_date, user_id)
VALUES ('TaskA', 'Description for task A',1,2,'2025-04-12 14:30:00',(SELECT user_id FROM users WHERE username = 'user_test_2'));
