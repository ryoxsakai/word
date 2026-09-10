-- Global revision detects concurrent writes from both MCP and the editor API.
CREATE TABLE idiom_mcp_revision (id INTEGER PRIMARY KEY CHECK(id = 1), revision INTEGER NOT NULL);
INSERT INTO idiom_mcp_revision VALUES (1, 0);
CREATE TABLE idiom_mcp_guard (id TEXT PRIMARY KEY, valid INTEGER NOT NULL CHECK(valid = 1));
CREATE TRIGGER idioms_mcp_insert AFTER INSERT ON idioms
BEGIN
  UPDATE idiom_mcp_revision SET revision = revision + 1 WHERE id = 1;
END;
CREATE TRIGGER idioms_mcp_update AFTER UPDATE ON idioms
BEGIN
  UPDATE idiom_mcp_revision SET revision = revision + 1 WHERE id = 1;
END;
CREATE TRIGGER idioms_mcp_delete AFTER DELETE ON idioms
BEGIN
  UPDATE idiom_mcp_revision SET revision = revision + 1 WHERE id = 1;
END;
CREATE TRIGGER idiom_senses_mcp_insert AFTER INSERT ON idiom_senses
BEGIN
  UPDATE idiom_mcp_revision SET revision = revision + 1 WHERE id = 1;
END;
CREATE TRIGGER idiom_senses_mcp_update AFTER UPDATE ON idiom_senses
BEGIN
  UPDATE idiom_mcp_revision SET revision = revision + 1 WHERE id = 1;
END;
CREATE TRIGGER idiom_senses_mcp_delete AFTER DELETE ON idiom_senses
BEGIN
  UPDATE idiom_mcp_revision SET revision = revision + 1 WHERE id = 1;
END;
CREATE TRIGGER idiom_word_refs_mcp_insert AFTER INSERT ON idiom_word_refs
BEGIN
  UPDATE idiom_mcp_revision SET revision = revision + 1 WHERE id = 1;
END;
CREATE TRIGGER idiom_word_refs_mcp_update AFTER UPDATE ON idiom_word_refs
BEGIN
  UPDATE idiom_mcp_revision SET revision = revision + 1 WHERE id = 1;
END;
CREATE TRIGGER idiom_word_refs_mcp_delete AFTER DELETE ON idiom_word_refs
BEGIN
  UPDATE idiom_mcp_revision SET revision = revision + 1 WHERE id = 1;
END;
CREATE TRIGGER idiom_sections_mcp_insert AFTER INSERT ON idiom_sections
BEGIN
  UPDATE idiom_mcp_revision SET revision = revision + 1 WHERE id = 1;
END;
CREATE TRIGGER idiom_sections_mcp_update AFTER UPDATE ON idiom_sections
BEGIN
  UPDATE idiom_mcp_revision SET revision = revision + 1 WHERE id = 1;
END;
CREATE TRIGGER idiom_sections_mcp_delete AFTER DELETE ON idiom_sections
BEGIN
  UPDATE idiom_mcp_revision SET revision = revision + 1 WHERE id = 1;
END;
