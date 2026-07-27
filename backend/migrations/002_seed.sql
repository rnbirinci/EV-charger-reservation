INSERT INTO devices (name, address, power, location, price) VALUES ('SUHUBE EVLERİ 22kW-1', 'Kemalpaşa Mahallesi, 130. Cd, Bina No: 15', 22, '40.752439, 30.355499', 9.9) ON CONFLICT (name) DO NOTHING;

INSERT INTO users (name, surname, role, license_plate, pin_hash) VALUES
('Ali','Yılmaz','admin','34ABC000','$2a$10$kOLiByH5iNIIGukvt2uc8.3KBH5UVJw5NoXnJloXmSrXhE3Ds9JfS'),
('Veli','Kaya','resident','34ABC001','$2a$10$zW4IPGZlj2oxxCW93UXge.GXcBlSKZg5/CcqNvyHd.LQafZ6fvyq6'),
('Ayşe','Demir','resident','34ABC002','$2a$10$cWDgLxE5chsjCvggEaPB0.6uuMbibllpdEELv/AJktoGNIC55CaRe'),
('Fatma','Şahin','resident','34ABC003','$2a$10$CzAzA.GbRKaUvmPQy7z82.IG1NzVW5bfrRmVic5pRCZxTP45LyZQa')
ON CONFLICT (license_plate) DO NOTHING;
