import express from 'express';
import { initDb } from './database';
import multer from 'multer';
import cloudinary from 'cloudinary';
import { UploadApiResponse, UploadApiErrorResponse } from 'cloudinary';
import { User } from './types';

const app = express();
const router = express.Router();

cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'video/mp4'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and MP4 are allowed.'));
    }
  },
});

interface UserProfile {
  id: number;
  username: string;
  verified: number;
  coins: number;
  xp: number;
  profile_media_url?: string;
  profile_media_type?: string;
  bio?: string;
  tier?: number;
  wins?: number;
  losses?: number;
  title?: string;
  legend_status?: string;
}

initDb()
  .then((db) => {
    app.set('db', db);

    router.use((req, res, next) => {
      req.db = app.get('db');
      if (!req.db) {
        return res.status(500).json({ message: 'Database not initialized' });
      }
      next();
    });

    function calculateLevel(xp: number): { level: number; rank: string } {
      let level = Math.floor(xp / 10) + 1;
      if (level > 100) level = 100;

      let rank = 'Newbie';
      if (level >= 11) rank = 'Rising Star';
      if (level >= 26) rank = 'Clout Lord';
      if (level >= 51) rank = 'Elite';
      if (level >= 76) rank = 'Titan';
      if (level >= 100) rank = 'Shadow Rank';

      return { level, rank };
    }

    // GET: Fetch user profile by username
    router.get('/profile/:username', async (req: express.Request, res: express.Response) => {
      const username = req.params.username;
      try {
        const user: UserProfile | undefined = await new Promise((resolve, reject) => {
          req.db.get(
            'SELECT id, username, verified, coins, xp, profile_media_url, profile_media_type, bio, tier, wins, losses, title, legend_status FROM users WHERE username = ?',
            [username],
            (err, row) => {
              if (err) reject(err);
              resolve(row as UserProfile);
            }
          );
        });
        if (!user) return res.status(404).json({ message: 'User not found' });

        const posts: any[] = await new Promise((resolve, reject) => {
          req.db.all(
            'SELECT * FROM posts WHERE user_id = ? ORDER BY created_at DESC',
            [user.id],
            (err, rows) => {
              if (err) reject(err);
              resolve(rows);
            }
          );
        });

        const { level, rank } = calculateLevel(user.xp);

        const userProfile = {
          username: user.username,
          verified: user.verified,
          coins: user.coins,
          rank,
          level,
          profile_media_url: user.profile_media_url,
          profile_media_type: user.profile_media_type,
          bio: user.bio,
          tier: user.tier,
          wins: user.wins,
          losses: user.losses,
          title: user.title,
          legend_status: user.legend_status,
        };

        res.json({ user: userProfile, posts });
      } catch (err: any) {
        console.error(`[${new Date().toISOString()}] Error fetching profile:`, err);
        res.status(500).json({ message: 'Internal server error: ' + err.message });
      }
    });

    // POST: Upload profile media
    router.post('/profile/upload', upload.single('media'), async (req: express.Request, res: express.Response) => {
      const { email } = req.body;
      const file = req.file;

      if (!email || !file) {
        return res.status(400).json({ message: 'Email and media file are required' });
      }
      if (!req.user || req.user.email !== email) {
        return res.status(403).json({ message: 'Unauthorized' });
      }

      try {
        const user: User | undefined = await new Promise((resolve, reject) => {
          req.db.get('SELECT id FROM users WHERE email = ?', [email], (err, row) => {
            if (err) reject(err);
            resolve(row as User);
          });
        });
        if (!user) return res.status(404).json({ message: 'User not found' });

        const uploadResult = await new Promise<UploadApiResponse>((resolve, reject) => {
          const stream = cloudinary.v2.uploader.upload_stream(
            {
              resource_type: file.mimetype.startsWith('image') ? 'image' : 'video',
              transformation: [{ quality: 'auto:low', fetch_format: 'auto' }],
            },
            (error: UploadApiErrorResponse | undefined, result: UploadApiResponse | undefined) => {
              if (error) reject(error);
              if (!result) reject(new Error('Upload failed'));
              resolve(result);
            }
          );
          stream.end(file.buffer);
        });

        const mediaUrl = uploadResult.secure_url;
        const mediaType = file.mimetype.startsWith('image') ? 'image' : 'video';

        await new Promise<void>((resolve, reject) => {
          req.db.run(
            'UPDATE users SET profile_media_url = ?, profile_media_type = ? WHERE id = ?',
            [mediaUrl, mediaType, user.id],
            (err) => {
              if (err) reject(err);
              resolve();
            }
          );
        });

        res.json({ message: 'Profile media uploaded successfully', profile_media_url: mediaUrl, profile_media_type: mediaType });
      } catch (err: any) {
        console.error(`[${new Date().toISOString()}] Error uploading profile media:`, err);
        res.status(500).json({ message: 'Internal server error: ' + err.message });
      }
    });

    // GET: Fetch user's squads
    router.get('/squads/:username', async (req: express.Request, res: express.Response) => {
      const username = req.params.username;
      try {
        const user: User | undefined = await new Promise((resolve, reject) => {
          req.db.get('SELECT id FROM users WHERE username = ?', [username], (err, row) => {
            if (err) reject(err);
            resolve(row as User);
          });
        });
        if (!user) return res.status(404).json({ message: 'User not found' });

        const squads: any[] = await new Promise((resolve, reject) => {
          req.db.all(
            'SELECT * FROM game_squads WHERE user_id = ?',
            [user.id],
            (err, rows) => {
              if (err) reject(err);
              resolve(rows);
            }
          );
        });

        res.json({ squads });
      } catch (err: any) {
        console.error(`[${new Date().toISOString()}] Error fetching squads:`, err);
        res.status(500).json({ message: 'Internal server error: ' + err.message });
      }
    });

    // GET: Fetch user's badges
    router.get('/badges/:username', async (req: express.Request, res: express.Response) => {
      const username = req.params.username;
      try {
        const user: User | undefined = await new Promise((resolve, reject) => {
          req.db.get('SELECT id FROM users WHERE username = ?', [username], (err, row) => {
            if (err) reject(err);
            resolve(row as User);
          });
        });
        if (!user) return res.status(404).json({ message: 'User not found' });

        const badges: any = await new Promise((resolve, reject) => {
          req.db.get('SELECT * FROM badges WHERE user_id = ?', [user.id], (err, row) => {
            if (err) reject(err);
            resolve(row);
          });
        });

        res.json({ badges: badges || {} });
      } catch (err: any) {
        console.error(`[${new Date().toISOString()}] Error fetching badges:`, err);
        res.status(500).json({ message: 'Internal server error: ' + err.message });
      }
    });

    // GET: Fetch user's developer picks
    router.get('/developer-picks/:username', async (req: express.Request, res: express.Response) => {
      const username = req.params.username;
      try {
        const user: User | undefined = await new Promise((resolve, reject) => {
          req.db.get('SELECT id FROM users WHERE username = ?', [username], (err, row) => {
            if (err) reject(err);
            resolve(row as User);
          });
        });
        if (!user) return res.status(404).json({ message: 'User not found' });

        const picks: any[] = await new Promise((resolve, reject) => {
          req.db.all('SELECT * FROM developer_picks WHERE user_id = ?', [user.id], (err, rows) => {
            if (err) reject(err);
            resolve(rows);
          });
        });

        res.json({ developerPicks: picks });
      } catch (err: any) {
        console.error(`[${new Date().toISOString()}] Error fetching developer picks:`, err);
        res.status(500).json({ message: 'Internal server error: ' + err.message });
      }
    });

    // GET: Fetch user's hall of fame entries
    router.get('/hall-of-fame/:username', async (req: express.Request, res: express.Response) => {
      const username = req.params.username;
      try {
        const user: User | undefined = await new Promise((resolve, reject) => {
          req.db.get('SELECT id FROM users WHERE username = ?', [username], (err, row) => {
            if (err) reject(err);
            resolve(row as User);
          });
        });
        if (!user) return res.status(404).json({ message: 'User not found' });

        const hallOfFame: any[] = await new Promise((resolve, reject) => {
          req.db.all('SELECT * FROM hall_of_fame WHERE user_id = ?', [user.id], (err, rows) => {
            if (err) reject(err);
            resolve(rows);
          });
        });

        res.json({ hallOfFame });
      } catch (err: any) {
        console.error(`[${new Date().toISOString()}] Error fetching hall of fame:`, err);
        res.status(500).json({ message: 'Internal server error: ' + err.message });
      }
    });

    // GET: Fetch user's post hall of fame entries
    router.get('/post-hall-of-fame/:username', async (req: express.Request, res: express.Response) => {
      const username = req.params.username;
      try {
        const user: User | undefined = await new Promise((resolve, reject) => {
          req.db.get('SELECT id FROM users WHERE username = ?', [username], (err, row) => {
            if (err) reject(err);
            resolve(row as User);
          });
        });
        if (!user) return res.status(404).json({ message: 'User not found' });

        const postHallOfFame: any[] = await new Promise((resolve, reject) => {
          req.db.all('SELECT * FROM post_hall_of_fame WHERE user_id = ?', [user.id], (err, rows) => {
            if (err) reject(err);
            resolve(rows);
          });
        });

        res.json({ postHallOfFame });
      } catch (err: any) {
        console.error(`[${new Date().toISOString()}] Error fetching post hall of fame:`, err);
        res.status(500).json({ message: 'Internal server error: ' + err.message });
      }
    });

    // POST: Update user bio
    router.post('/bio', async (req: express.Request, res: express.Response) => {
      const { email, bio } = req.body;
      if (!email || !bio) {
        return res.status(400).json({ message: 'Email and bio are required' });
      }
      if (!req.user || req.user.email !== email) {
        return res.status(403).json({ message: 'Unauthorized' });
      }
      try {
        const user: User | undefined = await new Promise((resolve, reject) => {
          req.db.get('SELECT id FROM users WHERE email = ?', [email], (err, row) => {
            if (err) reject(err);
            resolve(row as User);
          });
        });
        if (!user) return res.status(404).json({ message: 'User not found' });

        await new Promise<void>((resolve, reject) => {
          req.db.run('UPDATE users SET bio = ? WHERE id = ?', [bio, user.id], (err) => {
            if (err) reject(err);
            resolve();
          });
        });

        res.json({ message: 'Bio updated successfully' });
      } catch (err: any) {
        console.error(`[${new Date().toISOString()}] Error updating bio:`, err);
        res.status(500).json({ message: 'Internal server error: ' + err.message });
      }
    });

    // GET: Fetch user's inventory
    router.get('/inventory/:username', async (req: express.Request, res: express.Response) => {
      const username = req.params.username;
      try {
        const user: User | undefined = await new Promise((resolve, reject) => {
          req.db.get('SELECT id FROM users WHERE username = ?', [username], (err, row) => {
            if (err) reject(err);
            resolve(row as User);
          });
        });
        if (!user) return res.status(404).json({ message: 'User not found' });

        const inventory: any[] = await new Promise((resolve, reject) => {
          req.db.all(
            'SELECT i.*, s.name, s.category, s.image_url, s.description FROM user_inventory i JOIN shop_items s ON i.item_id = s.id WHERE i.user_id = ?',
            [user.id],
            (err, rows) => {
              if (err) reject(err);
              resolve(rows);
            }
          );
        });

        res.json({ inventory });
      } catch (err: any) {
        console.error(`[${new Date().toISOString()}] Error fetching inventory:`, err);
        res.status(500).json({ message: 'Internal server error: ' + err.message });
      }
    });

    // POST: Purchase an item
    router.post('/purchase', async (req: express.Request, res: express.Response) => {
      const { email, itemId } = req.body;
      if (!email || !itemId) {
        return res.status(400).json({ message: 'Email and itemId are required' });
      }
      if (!req.user || req.user.email !== email) {
        return res.status(403).json({ message: 'Unauthorized' });
      }
      try {
        const user: User | undefined = await new Promise((resolve, reject) => {
          req.db.get('SELECT id, coins FROM users WHERE email = ?', [email], (err, row) => {
            if (err) reject(err);
            resolve(row as User);
          });
        });
        if (!user) return res.status(404).json({ message: 'User not found' });

        const item: { price: number; stock?: number } | undefined = await new Promise((resolve, reject) => {
          req.db.get('SELECT price, stock FROM shop_items WHERE id = ?', [itemId], (err, row) => {
            if (err) reject(err);
            resolve(row as { price: number; stock?: number });
          });
        });
        if (!item) return res.status(404).json({ message: 'Item not found' });
        if (item.stock !== null && item.stock <= 0) {
          return res.status(400).json({ message: 'Item out of stock' });
        }
        if (user.coins < item.price) {
          return res.status(400).json({ message: 'Insufficient coins' });
        }

        await new Promise<void>((resolve, reject) => {
          req.db.run('UPDATE users SET coins = coins - ? WHERE id = ?', [item.price, user.id], (err) => {
            if (err) reject(err);
            resolve();
          });
        });

        await new Promise<void>((resolve, reject) => {
          req.db.run('INSERT INTO user_inventory (user_id, item_id) VALUES (?, ?)', [user.id, itemId], (err) => {
            if (err) reject(err);
            resolve();
          });
        });

        if (item.stock !== null) {
          await new Promise<void>((resolve, reject) => {
            req.db.run('UPDATE shop_items SET stock = stock - 1 WHERE id = ?', [itemId], (err) => {
              if (err) reject(err);
              resolve();
            });
          });
        }

        res.json({ message: 'Item purchased successfully' });
      } catch (err: any) {
        console.error(`[${new Date().toISOString()}] Error purchasing item:`, err);
        res.status(500).json({ message: 'Internal server error: ' + err.message });
      }
    });

    app.use('/users', router);
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });

export default router;
