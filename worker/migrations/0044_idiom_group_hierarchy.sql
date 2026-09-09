-- Optional Group metadata; existing idiom notebooks remain valid.
ALTER TABLE idiom_sections ADD COLUMN group_key TEXT;
ALTER TABLE idiom_sections ADD COLUMN group_subtitle TEXT;
ALTER TABLE idiom_sections ADD COLUMN group_order INTEGER;
