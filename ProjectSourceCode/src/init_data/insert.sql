INSERT INTO users (rewards_total, username, email, password_hashed) 
VALUES (0,'user_test', 'test_email@gmail.com', 'test_password');


INSERT INTO tasks (title, description, rewards, priority, due_date, user_id)   
VALUES ('Task1', 'Description for task 1',1,2,'2025-04-10 15:00:00',(SELECT user_id FROM users WHERE username = 'user_test'));

INSERT INTO tasks (title, description, rewards, priority, due_date, user_id)   
VALUES ('Task2', 'Description for task 2',1,2,'2025-04-11 12:30:00',(SELECT user_id FROM users WHERE username = 'user_test'));

INSERT INTO users (rewards_total, username, email, password_hashed) 
VALUES (0,'user_test_2', 'test_email_2@gmail.com', 'test_password_2');

INSERT INTO tasks (title, description, rewards, priority, due_date, user_id)
VALUES ('TaskA', 'Description for task A',1,2,'2025-04-12 14:30:00',(SELECT user_id FROM users WHERE username = 'user_test_2'));
