import express from 'express';
import { initDb } from './database';
import cloudinary from 'cloudinary';
import multer from 'multer';
import { UploadApiResponse, UploadApiErrorResponse } from 'cloudinary';
import { User } from './types';
require('dotenv').config(); // Added to match former code


const app = express();
const router = express.Router();

cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

interface Post {
  id: number;
  user_id: number;
  username: string;
  content: string;
  mode: string;
  likes: number;
  created_at: string;
  media_url?: string;
  media_type?: string;
  actual_username: string;
  verified: number;
  profile_media_url?: string;
  profile_media_type?: string;
  reactions?: string;
}

interface Comment {
  id: number;
  post_id: number;
  user_id: number;
  content: string;
  created_at: string;
  pinned: number;
  likes: number;
  username: string;
  profile_media_url?: string;
  profile_media_type?: string;
  replies?: Reply[];
}

interface Reply {
  id: number;
  comment_id: number;
  user_id: number;
  content: string;
  created_at: string;
  username: string;
  profile_media_url?: string;
  profile_media_type?: string;
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

    // Get all posts (exclude rants) with pagination
    router.get('/', async (req: express.Request, res: express.Response) => {
      try {
        const limit = parseInt(req.query.limit as string) || 10;
        const offset = parseInt(req.query.offset as string) || 0;

        const posts: Post[] = await new Promise((resolve, reject) => {
          req.db.all(
            'SELECT p.*, u.username as actual_username, u.verified, u.profile_media_url, u.profile_media_type FROM posts p JOIN users u ON p.user_id = u.id WHERE p.mode != ? ORDER BY p.created_at DESC LIMIT ? OFFSET ?',
            ['rant', limit, offset],
            (err, rows) => {
              if (err) reject(err);
              resolve(rows as Post[]);
            }
          );
        });
        res.json(posts);
      } catch (err: any) {
        res.status(500).json({ message: 'Internal server error', error: err.message });
      }
    });

    // Get news feed posts (include all posts) with pagination
    router.get('/newsfeed', async (req: express.Request, res: express.Response) => {
      try {
        const limit = parseInt(req.query.limit as string) || 10;
        const offset = parseInt(req.query.offset as string) || 0;

        const posts: Post[] = await new Promise((resolve, reject) => {
          req.db.all(
            'SELECT p.*, u.username as actual_username, u.verified, u.profile_media_url, u.profile_media_type FROM posts p JOIN users u ON p.user_id = u.id ORDER BY p.created_at DESC LIMIT ? OFFSET ?',
            [limit, offset],
            (err, rows) => {
              if (err) reject(err);
              resolve(rows as Post[]);
            }
          );
        });
        res.json(posts);
      } catch (err: any) {
        res.status(500).json({ message: 'Internal server error', error: err.message });
      }
    });

    // Create a new post
    router.post('/create-post', upload.single('media'), async (req: express.Request, res: express.Response) => {
      const { email, content, mode } = req.body;
      const mediaFile = req.file;

      if (!email || !content || !mode) {
        return res.status(400).json({ message: 'Email, content, and mode are required' });
      }
      if (!req.user || req.user.email !== email) {
        return res.status(403).json({ message: 'Unauthorized' });
      }

      try {
        const user: User | undefined = await new Promise((resolve, reject) => {
          req.db.get('SELECT id, username FROM users WHERE email = ?', [email], (err, row) => {
            if (err) reject(err);
            resolve(row as User);
          });
        });
        if (!user) return res.status(404).json({ message: 'User not found' });

        let mediaUrl: string | null = null;
        let mediaType: string | null = null;

        if (mediaFile) {
          const uniqueId = `post_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
          const uploadResult = await new Promise<UploadApiResponse>((resolve, reject) => {
            const stream = cloudinary.v2.uploader.upload_stream(
              {
                resource_type: mediaFile.mimetype.startsWith('video') ? 'video' : 'image',
                folder: 'posts',
                public_id: uniqueId,
              },
              (error: UploadApiErrorResponse | undefined, result: UploadApiResponse | undefined) => {
                if (error) reject(error);
                resolve(result!);
              }
            );
            stream.end(mediaFile.buffer);
          });

          mediaUrl = uploadResult.secure_url;
          mediaType = mediaFile.mimetype.startsWith('video') ? 'video' : 'image';
        }

        await new Promise<void>((resolve, reject) => {
          req.db.run(
            'INSERT INTO posts (user_id, username, content, mode, created_at, media_url, media_type) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [user.id, user.username, content, mode, new Date().toISOString(), mediaUrl, mediaType],
            (err) => {
              if (err) reject(err);
              resolve();
            }
          );
        });

        res.json({ message: 'Post created successfully' });
      } catch (err: any) {
        console.error('Error creating post:', err);
        res.status(500).json({ message: 'Internal server error', error: err.message });
      }
    });

    // Edit a post
    router.put('/edit/:postId', async (req: express.Request, res: express.Response) => {
      const { email, content } = req.body;
      const postId = req.params.postId;
      if (!email || !content || !postId) {
        return res.status(400).json({ message: 'Email, content, and postId are required' });
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

        const post: { user_id: number } | undefined = await new Promise((resolve, reject) => {
          req.db.get('SELECT user_id FROM posts WHERE id = ?', [postId], (err, row) => {
            if (err) reject(err);
            resolve(row as { user_id: number });
          });
        });
        if (!post) return res.status(404).json({ message: 'Post not found' });
        if (post.user_id !== user.id) {
          return res.status(403).json({ message: 'Unauthorized: You can only edit your own posts' });
        }

        await new Promise<void>((resolve, reject) => {
          req.db.run('UPDATE posts SET content = ? WHERE id = ?', [content, postId], (err) => {
            if (err) reject(err);
            resolve();
          });
        });
        res.json({ message: 'Post updated successfully' });
      } catch (err: any) {
        res.status(500).json({ message: 'Internal server error', error: err.message });
      }
    });

    // Delete a post
    router.delete('/delete/:postId', async (req: express.Request, res: express.Response) => {
      const { email } = req.body;
      const postId = req.params.postId;
      if (!email || !postId) {
        return res.status(400).json({ message: 'Email and postId are required' });
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

        const post: { user_id: number } | undefined = await new Promise((resolve, reject) => {
          req.db.get('SELECT user_id FROM posts WHERE id = ?', [postId], (err, row) => {
            if (err) reject(err);
            resolve(row as { user_id: number });
          });
        });
        if (!post) return res.status(404).json({ message: 'Post not found' });
        if (post.user_id !== user.id) {
          return res.status(403).json({ message: 'Unauthorized: You can only delete your own posts' });
        }

        await new Promise<void>((resolve, reject) => {
          req.db.run('DELETE FROM posts WHERE id = ?', [postId], (err) => {
            if (err) reject(err);
            resolve();
          });
        });
        res.json({ message: 'Post deleted successfully' });
      } catch (err: any) {
        res.status(500).json({ message: 'Internal server error', error: err.message });
      }
    });

    // Like a post
    router.post('/like', async (req: express.Request, res: express.Response) => {
      const { email, postId } = req.body;
      if (!email || !postId) {
        return res.status(400).json({ message: 'Email and postId are required' });
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
          req.db.run('UPDATE posts SET likes = likes + 1 WHERE id = ?', [postId], (err) => {
            if (err) reject(err);
            resolve();
          });
        });
        res.json({ message: 'Post liked successfully' });
      } catch (err: any) {
        res.status(500).json({ message: 'Internal server error', error: err.message });
      }
    });

    // Add reaction to a post
    router.post('/react', async (req: express.Request, res: express.Response) => {
      const { email, postId, reaction } = req.body;
      if (!email || !postId || !reaction) {
        return res.status(400).json({ message: 'Email, postId, and reaction are required' });
      }
      if (!req.user || req.user.email !== email) {
        return res.status(403).json({ message: 'Unauthorized' });
      }
      try {
        const user: User | undefined = await new Promise((resolve, reject) => {
          req.db.get('SELECT id, username FROM users WHERE email = ?', [email], (err, row) => {
            if (err) reject(err);
            resolve(row as User);
          });
        });
        if (!user) return res.status(404).json({ message: 'User not found' });

        const post: { reactions?: string } | undefined = await new Promise((resolve, reject) => {
          req.db.get('SELECT reactions FROM posts WHERE id = ?', [postId], (err, row) => {
            if (err) reject(err);
            resolve(row as { reactions?: string });
          });
        });
        if (!post) return res.status(404).json({ message: 'Post not found' });

        let reactions = post.reactions ? JSON.parse(post.reactions) : {};
        reactions[reaction] = reactions[reaction] || [];
        if (!reactions[reaction].includes(user.username)) {
          reactions[reaction].push(user.username);
        }

        await new Promise<void>((resolve, reject) => {
          req.db.run('UPDATE posts SET reactions = ? WHERE id = ?', [JSON.stringify(reactions), postId], (err) => {
            if (err) reject(err);
            resolve();
          });
        });
        res.json({ message: 'Reaction added successfully' });
      } catch (err: any) {
        res.status(500).json({ message: 'Internal server error', error: err.message });
      }
    });

    // Share a post
    router.post('/share', async (req: express.Request, res: express.Response) => {
      const { email, postId, squadId } = req.body;
      if (!email || !postId || !squadId) {
        return res.status(400).json({ message: 'Email, postId, and squadId are required' });
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

        const post: Post | undefined = await new Promise((resolve, reject) => {
          req.db.get('SELECT * FROM posts WHERE id = ?', [postId], (err, row) => {
            if (err) reject(err);
            resolve(row as Post);
          });
        });
        if (!post) return res.status(404).json({ message: 'Post not found' });

        await new Promise<void>((resolve, reject) => {
          req.db.run(
            'INSERT INTO posts (user_id, content, mode, created_at, squad_id, media_url, media_type) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [user.id, post.content, post.mode, new Date().toISOString(), squadId, post.media_url, post.media_type],
            (err) => {
              if (err) reject(err);
              resolve();
            }
          );
        });
        res.json({ message: 'Post shared successfully' });
      } catch (err: any) {
        res.status(500).json({ message: 'Internal server error', error: err.message });
      }
    });

    // Get comments for a post
    router.get('/comments/:postId', async (req: express.Request, res: express.Response) => {
      const postId = req.params.postId;
      try {
        const comments: Comment[] = await new Promise((resolve, reject) => {
          req.db.all(
            'SELECT c.*, u.username, u.profile_media_url, u.profile_media_type FROM comments c JOIN users u ON c.user_id = u.id WHERE c.post_id = ? ORDER BY c.created_at ASC',
            [postId],
            (err, rows) => {
              if (err) reject(err);
              resolve(rows as Comment[]);
            }
          );
        });

        for (const comment of comments) {
          const replies: Reply[] = await new Promise((resolve, reject) => {
            req.db.all(
              'SELECT r.*, u.username, u.profile_media_url, u.profile_media_type FROM replies r JOIN users u ON r.user_id = u.id WHERE r.comment_id = ? ORDER BY r.created_at ASC',
              [comment.id],
              (err, rows) => {
                if (err) reject(err);
                resolve(rows as Reply[]);
              }
            );
          });
          comment.replies = replies;
        }

        res.json(comments);
      } catch (err: any) {
        res.status(500).json({ message: 'Internal server error', error: err.message });
      }
    });

    // Add a comment
    router.post('/comments', async (req: express.Request, res: express.Response) => {
      const { email, postId, content } = req.body;
      if (!email || !postId || !content) {
        return res.status(400).json({ message: 'Email, postId, and content are required' });
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

        const post: { id: number } | undefined = await new Promise((resolve, reject) => {
          req.db.get('SELECT id FROM posts WHERE id = ?', [parseInt(postId)], (err, row) => {
            if (err) reject(err);
            resolve(row as { id: number });
          });
        });
        if (!post) return res.status(404).json({ message: 'Post not found' });

        await new Promise<void>((resolve, reject) => {
          req.db.run(
            'INSERT INTO comments (post_id, user_id, content, created_at) VALUES (?, ?, ?, ?)',
            [parseInt(postId), user.id, content, new Date().toISOString()],
            (err) => {
              if (err) reject(err);
              resolve();
            }
          );
        });
        res.json({ message: 'Comment added successfully' });
      } catch (err: any) {
        console.error('Error adding comment:', err);
        res.status(500).json({ message: 'Internal server error: ' + err.message });
      }
    });

    // Add a reply to a comment
    router.post('/comments/reply', async (req: express.Request, res: express.Response) => {
      const { email, commentId, content } = req.body;
      if (!email || !commentId || !content) {
        return res.status(400).json({ message: 'Email, commentId, and content are required' });
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
          req.db.run(
            'INSERT INTO replies (comment_id, user_id, content, created_at) VALUES (?, ?, ?, ?)',
            [commentId, user.id, content, new Date().toISOString()],
            (err) => {
              if (err) reject(err);
              resolve();
            }
          );
        });
        res.json({ message: 'Reply added successfully' });
      } catch (err: any) {
        res.status(500).json({ message: 'Internal server error', error: err.message });
      }
    });

    // Like a comment
    router.post('/comments/like', async (req: express.Request, res: express.Response) => {
      const { email, commentId } = req.body;
      if (!email || !commentId) {
        return res.status(400).json({ message: 'Email and commentId are required' });
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
          req.db.run('UPDATE comments SET likes = likes + 1 WHERE id = ?', [commentId], (err) => {
            if (err) reject(err);
            resolve();
          });
        });
        res.json({ message: 'Comment liked successfully' });
      } catch (err: any) {
        res.status(500).json({ message: 'Internal server error', error: err.message });
      }
    });

    // Pin a comment
    router.post('/comments/pin', async (req: express.Request, res: express.Response) => {
      const { email, commentId, postId } = req.body;
      if (!email || !commentId || !postId) {
        return res.status(400).json({ message: 'Email, commentId, and postId are required' });
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

        const post: { user_id: number } | undefined = await new Promise((resolve, reject) => {
          req.db.get('SELECT user_id FROM posts WHERE id = ?', [postId], (err, row) => {
            if (err) reject(err);
            resolve(row as { user_id: number });
          });
        });
        if (!post) return res.status(404).json({ message: 'Post not found' });
        if (post.user_id !== user.id) {
          return res.status(403).json({ message: 'Unauthorized: You can only pin comments on your own posts' });
        }

        await new Promise<void>((resolve, reject) => {
          req.db.run('UPDATE comments SET pinned = 0 WHERE post_id = ?', [postId], (err) => {
            if (err) reject(err);
            resolve();
          });
        });

        await new Promise<void>((resolve, reject) => {
          req.db.run('UPDATE comments SET pinned = 1 WHERE id = ?', [commentId], (err) => {
            if (err) reject(err);
            resolve();
          });
        });
        res.json({ message: 'Comment pinned successfully' });
      } catch (err: any) {
        res.status(500).json({ message: 'Internal server error', error: err.message });
      }
    });

    app.use('/posts', router);
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });

export default router;
