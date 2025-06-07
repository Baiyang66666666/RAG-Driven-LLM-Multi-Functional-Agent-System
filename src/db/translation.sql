-- default_glossary + other organizations glossary
-- Drop tables if they exist
DROP TABLE IF EXISTS standard_apartments; 
DROP TABLE IF EXISTS IQ; 
DROP TABLE IF EXISTS UNITE;

-- Create the standard_apartments table with UUID primary key
CREATE TABLE IF NOT EXISTS standard_apartments (
    id TEXT PRIMARY KEY,
    OriginalWord TEXT,
    Translation TEXT
);

-- Insert example data into standard_apartments table with UUIDs
INSERT INTO standard_apartments (id, OriginalWord, Translation) 
VALUES ('550e8400-e29b-41d4-a716-446655440000', 'Security Deposit', '保证金'), 
       ('550e8400-e29b-41d4-a716-446655440001', 'Credit Check', '信用检查'), 
       ('550e8400-e29b-41d4-a716-446655440002', 'Move-in Date', '入住日期'), 
       ('550e8400-e29b-41d4-a716-446655440003', 'Pet Policy', '宠物政策');

-- Create the IQ table with UUID primary key
CREATE TABLE IF NOT EXISTS IQ (
    id TEXT PRIMARY KEY,
    OriginalWord TEXT,
    Translation TEXT
);

-- Insert example data into IQ table with UUIDs
INSERT INTO IQ (id, OriginalWord, Translation) 
VALUES ('550e8400-e29b-41d4-a716-446655440004', 'Apartment', '公寓'), 
       ('550e8400-e29b-41d4-a716-446655440005', 'Tenant', '租户'), 
       ('550e8400-e29b-41d4-a716-446655440006', 'Landlord', '房东'), 
       ('550e8400-e29b-41d4-a716-446655440007', 'Deposit', '押金');

-- Create the UNITE table with UUID primary key
CREATE TABLE IF NOT EXISTS UNITE (
    id TEXT PRIMARY KEY,
    OriginalWord TEXT,
    Translation TEXT
);

-- Insert example data into UNITE table with UUIDs
INSERT INTO UNITE (id, OriginalWord, Translation) 
VALUES ('550e8400-e29b-41d4-a716-446655440008', 'Security Deposit', '保证金'), 
       ('550e8400-e29b-41d4-a716-446655440009', 'Credit Check', '信用检查'), 
       ('550e8400-e29b-41d4-a716-44665544000a', 'Move-in Date', '入住日期'), 
       ('550e8400-e29b-41d4-a716-44665544000b', 'Pet Policy', '宠物政策');

-- Drop the table if it already exists
DROP TABLE IF EXISTS organization_instructions;

-- Create the table if it does not exist
CREATE TABLE IF NOT EXISTS organization_instructions (
    OrganizationName TEXT,
    Instructions TEXT
);

-- Insert example data into the table
INSERT INTO organization_instructions (OrganizationName, Instructions) VALUES 
('standard_apartments', 'Please translate the text into Chinese:'),
('IQ', 'Please translate the text into Chinese:'),
('UNITE', 'Please translate the text into Chinese:');
