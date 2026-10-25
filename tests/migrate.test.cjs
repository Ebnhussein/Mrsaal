const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path');
const {PGlite}=require('@electric-sql/pglite');
const {migrate,files}=require('../utils/migrate');
function folder(entries){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mrsaal-migrations-'));for(const [name,sql]of Object.entries(entries))fs.writeFileSync(path.join(dir,name),sql);return dir;}
test('applies numbered files once, in order, and ignores other files',async()=>{
 const db=new PGlite(),dir=folder({'0002_add_note.sql':'ALTER TABLE t ADD COLUMN note TEXT;','0001_create_t.sql':'CREATE TABLE t(id INT);INSERT INTO t VALUES(1);','README.md':'x','bad name.sql':'DROP TABLE t;'});
 assert.deepEqual(files(dir),['0001_create_t.sql','0002_add_note.sql']);
 assert.deepEqual(await migrate(db,dir),['0001_create_t.sql','0002_add_note.sql']);
 assert.deepEqual(await migrate(db,dir),[]);
 assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM schema_migrations')).rows[0].n,2);
 assert.equal((await db.query('SELECT note FROM t')).rows.length,1);
});
test('a failing file rolls back, names itself, and later files do not run',async()=>{
 const db=new PGlite(),dir=folder({'0001_ok.sql':'CREATE TABLE a(id INT);','0002_bad.sql':'CREATE TABLE b(id INT);SELECT * FROM missing_table;','0003_never.sql':'CREATE TABLE c(id INT);'});
 await assert.rejects(migrate(db,dir),/Migration 0002_bad\.sql failed/);
 assert.deepEqual((await db.query('SELECT name FROM schema_migrations')).rows.map(r=>r.name),['0001_ok.sql']);
 assert.equal((await db.query("SELECT to_regclass('b') AS t")).rows[0].t,null);assert.equal((await db.query("SELECT to_regclass('c') AS t")).rows[0].t,null);
});
test('a missing migrations folder is fine',async()=>{assert.deepEqual(await migrate(new PGlite(),path.join(os.tmpdir(),'no-such-migrations-dir')),[]);});
