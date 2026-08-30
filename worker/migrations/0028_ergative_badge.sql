-- 能格動詞: 自動詞の主語と、対応する他動詞の目的語が同じ参与者になる語。
-- 例: The door closed. / She closed the door.
ALTER TABLE words ADD COLUMN ergative INTEGER NOT NULL DEFAULT 0;

-- crossover の全見出し語を、自動詞側と他動詞側の両方向から精査した結果を反映する。
-- sell well のような中間構文や、単に自他で別義を持つ語は含めない。
UPDATE words
SET ergative = 1
WHERE id IN (
  'increase', 'improve', 'decrease', 'reduce', 'vary', 'shift', 'alter', 'expand',
  'extend', 'collapse', 'complete', 'operate', 'breed', 'contract', 'rush', 'spread',
  'tear', 'stretch', 'scatter', 'drain', 'crash', 'shrink', 'advance', 'unite',
  'revive', 'reverse', 'hang', 'fold', 'bend', 'shake', 'pour', 'spill', 'float',
  'freeze', 'melt', 'crack', 'pop', 'explode', 'spoil', 'heal', 'unfold', 'pause',
  'register', 'grow', 'turn', 'set', 'stop', 'tire', 'relax', 'move', 'begin',
  'start', 'continue', 'cease', 'commence', 'finish', 'resume', 'combine', 'connect',
  'switch', 'adapt', 'adjust', 'transfer', 'change', 'transform', 'convert', 'form',
  'develop', 'divide', 'split', 'break', 'integrate', 'separate', 'originate', 'retire',
  'settle', 'withdraw', 'hide', 'mingle', 'concentrate', 'feed', 'engage', 'join',
  'enroll', 'run', 'burst', 'plunge', 'merge', 'lean', 'reconcile', 'assemble',
  'accelerate', 'renew', 'halt', 'close', 'end', 'board', 'pass', 'work', 'graduate',
  'resolve', 'spring', 'stick', 'update', 'abort', 'replicate', 'differentiate',
  'accumulate', 'fracture', 'filter'
)
AND EXISTS (
  SELECT 1
  FROM list_items li
  WHERE li.word_id = words.id
    AND li.list_id = 'crossover-v3'
);
