-- Data demo (menu, opsi, voucher). Semuanya bisa diubah dari halaman Admin. Dijalankan hanya bila tabel categories kosong.

insert into categories (id, name, sort) values (1,'Kopi',1),(2,'Non-Kopi',2),(3,'Teh & Segar',3);

insert into option_groups (id, name, kind, required, sort) values
  (1,'Ukuran','single',true,1),
  (2,'Level gula','single',true,2),
  (3,'Level es','single',true,3),
  (4,'Topping','multi',false,4),
  (5,'Tambahan kopi','multi',false,5);

insert into options (group_id, name, price_delta, is_default, sort) values
  (1,'Regular',0,true,1),(1,'Large',5000,false,2),
  (2,'Gula normal',0,true,1),(2,'Kurang manis',0,false,2),(2,'Tanpa gula',0,false,3),
  (3,'Es normal',0,true,1),(3,'Sedikit es',0,false,2),(3,'Tanpa es',0,false,3),
  (4,'Boba',4000,false,1),(4,'Cheese foam',6000,false,2),(4,'Jelly',3000,false,3),
  (5,'Extra shot',5000,false,1),(5,'Susu oat',6000,false,2);

insert into products (id, category_id, name, description, price, sort) values
  (1,1,'Es Kopi Susu Gula Aren','Espresso, susu segar, dan gula aren asli.',22000,1),
  (2,1,'Americano','Espresso dengan air, ringan dan segar.',18000,2),
  (3,1,'Cappuccino','Espresso dengan susu berbusa tebal.',24000,3),
  (4,1,'Caramel Latte','Kopi susu dengan saus karamel.',26000,4),
  (5,2,'Matcha Latte','Matcha Jepang dengan susu segar.',25000,5),
  (6,2,'Coklat Premium','Coklat pekat dengan susu, manis seimbang.',22000,6),
  (7,2,'Taro Latte','Taro creamy dengan susu segar.',24000,7),
  (8,3,'Es Teh Manis','Teh tubruk seduh, manis pas.',8000,8),
  (9,3,'Lemon Tea','Teh dengan perasan lemon segar.',14000,9),
  (10,3,'Lychee Tea','Teh dengan sirup dan buah leci.',18000,10),
  (11,3,'Es Jeruk Peras','Jeruk peras asli, tanpa pengawet.',15000,11);

insert into product_option_groups (product_id, group_id)
  select p.id, g from products p, unnest(array[1,2,3]) g
  union all select p.id, 5 from products p where p.category_id = 1
  union all select p.id, 4 from products p where p.category_id = 2 or p.id in (9,10);

insert into vouchers (code, kind, value, min_subtotal, max_discount) values ('HEMAT10','percent',10,30000,10000);
insert into vouchers (code, kind, value, min_subtotal) values ('KOPIPAGI','amount',5000,20000);

select setval(pg_get_serial_sequence('categories','id'), (select max(id) from categories));
select setval(pg_get_serial_sequence('option_groups','id'), (select max(id) from option_groups));
select setval(pg_get_serial_sequence('products','id'), (select max(id) from products));

