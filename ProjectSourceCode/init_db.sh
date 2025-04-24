#!/bin/bash

# DO NOT PUSH THIS FILE TO GITHUB
# This file contains sensitive information and should be kept private

# TODO: Set your PostgreSQL URI - Use the External Database URL from the Render dashboard
PG_URI="postgresql://task_managers:cSiiYuHGxKfCWRmUpj4u1mtLfuPZdZ32@dpg-d00iuuqli9vc739vdro0-a.ohio-postgres.render.com/users_db_cwa5"

# Execute each .sql file in the directory
for file in src/init_data/*.sql; do
    echo "Executing $file..."
    psql $PG_URI -f "$file"
done