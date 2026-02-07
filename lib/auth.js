import bcrypt from 'bcryptjs';
import { getDB } from './db.js';
import { v4 as uuidv4 } from 'uuid';

export async function hashPassword(password) {
  return await bcrypt.hash(password, 10);
}

export async function verifyPassword(password, hash) {
  return await bcrypt.compare(password, hash);
}

export function createAdminUser(username, password, role = 'analyst') {
  const db = getDB();
  const id = uuidv4();
  const passwordHash = bcrypt.hashSync(password, 10);
  
  try {
    db.prepare(`
      INSERT INTO admin_users (id, username, password_hash, role)
      VALUES (?, ?, ?, ?)
    `).run(id, username, passwordHash, role);
    
    return { success: true, id };
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return { success: false, error: 'Utilisateur existe déjà' };
    }
    throw error;
  }
}

export function authenticateAdmin(username, password) {
  const db = getDB();
  
  const user = db.prepare(`
    SELECT * FROM admin_users WHERE username = ?
  `).get(username);
  
  if (!user) {
    return { success: false, error: 'Utilisateur non trouvé' };
  }
  
  const valid = bcrypt.compareSync(password, user.password_hash);
  
  if (!valid) {
    return { success: false, error: 'Mot de passe incorrect' };
  }
  
  return {
    success: true,
    user: {
      id: user.id,
      username: user.username,
      role: user.role
    }
  };
}

export function initializeDefaultAdmin() {
  const db = getDB();
  
  const existingAdmin = db.prepare(`
    SELECT * FROM admin_users WHERE username = ?
  `).get(process.env.ADMIN_DEFAULT_USERNAME || 'admin');
  
  if (!existingAdmin) {
    const result = createAdminUser(
      process.env.ADMIN_DEFAULT_USERNAME || 'admin',
      process.env.ADMIN_DEFAULT_PASSWORD || 'admin123',
      'admin'
    );
    
    if (result.success) {
      console.log('✓ Default admin user created');
    }
  }
}

export function checkPermission(userRole, requiredRole) {
  const roles = ['analyst', 'moderator', 'admin'];
  const userLevel = roles.indexOf(userRole);
  const requiredLevel = roles.indexOf(requiredRole);
  
  return userLevel >= requiredLevel;
}
