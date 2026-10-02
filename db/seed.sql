-- Sample catalog for Ile Aro. Re-running this updates names, copy and prices
-- but leaves stock levels alone, so it won't undo real sales.
-- Prices are in kobo: 2400000 = ₦24,000.

insert into products
  (slug, name, summary, description, category, technique, price_kobo, stock, details, art, featured, sort_order)
values
  ('olosupa-moon-cloth', 'Olosupa moon cloth',
   'Big tied moons on deep indigo. 2 yards.',
   'Olosupa means "moons". Each one starts as a pinch of cloth bound tight with raffia before the cotton goes into the dye pit. The binding keeps the dye out and the creases around it drink it in, so every moon opens into fine pale rays. No two come out the same size.',
   'cloth', 'oniko', 2400000, 12,
   '[["Fabric", "Medium-weight cotton"], ["Length", "2 yards (1.8 m) × 112 cm"], ["Care", "Hand wash cold on its own; dry in the shade"]]',
   '{"pattern": "moons", "seed": 11, "tone": "deep"}', true, 10),

  ('ibadandun-panel-cloth', 'Ibadandun panel cloth',
   'Hand-painted starch panels. 2 yards.',
   'Ibadandun ("Ibadan is sweet") is one of the best-known eleko designs: a grid of squares, each painted freehand with its own motif. The painter works with cassava starch and a feather or palm rib, so every line has a slight wobble that a printer can''t fake.',
   'cloth', 'eleko', 3200000, 8,
   '[["Fabric", "Medium-weight cotton"], ["Length", "2 yards (1.8 m) × 112 cm"], ["Care", "Hand wash cold on its own; dry in the shade"]]',
   '{"pattern": "panels", "seed": 5, "tone": "deep"}', true, 20),

  ('ladder-stitch-scarf', 'Ladder stitch scarf',
   'Light cotton voile. 70 × 180 cm.',
   'Stitched rails and rungs run the length of this light voile scarf. It is long enough to wrap twice around the neck or to tie as a head wrap.',
   'scarves', 'alabere', 1450000, 15,
   '[["Fabric", "Cotton voile"], ["Size", "70 × 180 cm"], ["Care", "Hand wash cold"]]',
   '{"pattern": "ladder", "seed": 19, "tone": "mid"}', true, 30),

  ('market-tote', 'Market tote',
   'Everyday tote with eleko panels, canvas-lined.',
   'A sturdy everyday tote made from our panel cloth and lined with plain canvas. It takes a laptop, a big water bottle and the day''s shopping without losing its shape.',
   'bags', 'eleko', 1300000, 25,
   '[["Size", "38 × 42 cm with a 10 cm base"], ["Handles", "60 cm drop"], ["Lining", "Cotton canvas with an inside pocket"]]',
   '{"pattern": "panels", "seed": 88, "tone": "mid"}', true, 40),

  ('stitched-kaftan', 'Stitched kaftan',
   'Loose unisex kaftan in stitched stripes.',
   'A loose, ankle-length kaftan with side pockets, cut from running stitch cloth. One size fits most. If you would like it hemmed, put your height in the delivery notes at checkout.',
   'wear', 'alabere', 4800000, 5,
   '[["Fit", "One size, relaxed"], ["Length", "140 cm"], ["Pockets", "Two side pockets"]]',
   '{"pattern": "stripes", "seed": 99, "tone": "mid"}', true, 50),

  ('seed-pod-cloth', 'Seed pod cloth',
   'Rows of small tied rings. 2 yards.',
   'Hundreds of small knots, each tied around a seed, leave rows of pale rings across the cloth. An easy everyday pattern for shirts, skirts and head ties.',
   'cloth', 'oniko', 2150000, 18,
   '[["Fabric", "Medium-weight cotton"], ["Length", "2 yards (1.8 m) × 112 cm"], ["Care", "Hand wash cold on its own; dry in the shade"]]',
   '{"pattern": "seeds", "seed": 23, "tone": "mid"}', false, 60),

  ('olokun-wave-cloth', 'Olokun wave cloth',
   'Rolling starch-resist waves. 2 yards.',
   'Named for Olokun, keeper of the deep sea. Bands of rolling lines and scallops are painted on in starch, then the cloth is dipped again and again until the blue is close to black.',
   'cloth', 'eleko', 2950000, 6,
   '[["Fabric", "Medium-weight cotton"], ["Length", "2 yards (1.8 m) × 112 cm"], ["Care", "Hand wash cold on its own; dry in the shade"]]',
   '{"pattern": "waves", "seed": 31, "tone": "mid"}', false, 70),

  ('running-stitch-cloth', 'Running stitch cloth',
   'Stitched stripes, unpicked after dyeing. 2 yards.',
   'Lines of running stitch are sewn across the cloth and pulled tight before it is dyed. When the thread comes out it leaves stripes with soft, broken edges that no print can copy.',
   'cloth', 'alabere', 2600000, 10,
   '[["Fabric", "Medium-weight cotton"], ["Length", "2 yards (1.8 m) × 112 cm"], ["Care", "Hand wash cold on its own; dry in the shade"]]',
   '{"pattern": "stripes", "seed": 7, "tone": "deep"}', false, 80),

  ('little-moons-scarf', 'Little moons scarf',
   'Tied moons on a lighter dip. 70 × 180 cm.',
   'This one comes out of the dye pit early, so the blue is lighter and the tied moons look almost silver against it.',
   'scarves', 'oniko', 1250000, 20,
   '[["Fabric", "Cotton voile"], ["Size", "70 × 180 cm"], ["Care", "Hand wash cold"]]',
   '{"pattern": "sunburst", "seed": 41, "tone": "light"}', false, 90),

  ('weekend-tote', 'Weekend tote',
   'Large zip-top tote in stitched chevrons.',
   'Our biggest bag, with a zip top and leather-trimmed handles. The chevrons are stitched and pulled before dyeing, so every line is a little uneven.',
   'bags', 'alabere', 1850000, 9,
   '[["Size", "50 × 40 cm with a 15 cm base"], ["Closure", "Brass zip"], ["Lining", "Cotton canvas"]]',
   '{"pattern": "chevron", "seed": 64, "tone": "deep"}', false, 100),

  ('moon-cushion-covers', 'Moon cushion covers, pair',
   'Two 45 × 45 cm covers with hidden zips.',
   'Two covers cut from the same length of olosupa cloth, so they match without being identical. Inserts are not included.',
   'home', 'oniko', 1600000, 14,
   '[["Size", "45 × 45 cm each"], ["Closure", "Hidden zip"], ["Inserts", "Not included"]]',
   '{"pattern": "moons", "seed": 52, "tone": "mid"}', false, 110),

  ('panel-table-runner', 'Panel table runner',
   'A row of painted panels. 35 × 180 cm.',
   'A line of hand-painted squares, hemmed by hand. Long enough for a table that seats six. Wash it once before first use.',
   'home', 'eleko', 1550000, 7,
   '[["Size", "35 × 180 cm"], ["Fabric", "Medium-weight cotton"], ["Care", "Hand wash cold"]]',
   '{"pattern": "panels", "seed": 140, "tone": "deep"}', false, 120),

  ('oniko-bucket-hat', 'Oniko bucket hat',
   'Reversible: seed pods outside, plain indigo inside.',
   'Seed pod cloth on one side and plain indigo on the other, so it goes with everything. Fits a head up to 58 cm around.',
   'wear', 'oniko', 950000, 3,
   '[["Size", "Up to 58 cm head"], ["Fabric", "Cotton, two layers"], ["Care", "Hand wash cold"]]',
   '{"pattern": "seeds", "seed": 77, "tone": "deep"}', false, 130),

  ('night-indigo-wrapper', 'Night indigo wrapper',
   'Our darkest dip. 2 yards.',
   'Dipped more than twenty times, until the indigo is nearly black and the starch lines stand out like chalk. We make only a few at a time.',
   'cloth', 'eleko', 2700000, 0,
   '[["Fabric", "Medium-weight cotton"], ["Length", "2 yards (1.8 m) × 112 cm"], ["Care", "Hand wash cold on its own; dry in the shade"]]',
   '{"pattern": "waves", "seed": 12, "tone": "deep"}', false, 140)
on conflict (slug) do update set
  name        = excluded.name,
  summary     = excluded.summary,
  description = excluded.description,
  category    = excluded.category,
  technique   = excluded.technique,
  price_kobo  = excluded.price_kobo,
  details     = excluded.details,
  art         = excluded.art,
  featured    = excluded.featured,
  sort_order  = excluded.sort_order,
  updated_at  = now();
