INSERT INTO users (rewards_total, username, email, password_hashed) 
VALUES (0,'user_test', 'test_email@gmail.com', 'test_password');


INSERT INTO tasks (title, description, rewards, priority, due_date, user_id)   
VALUES ('test_title', 'test_description',1,2,'2025-04-10 15:00:00',(SELECT user_id FROM users WHERE username = 'user_test'));
