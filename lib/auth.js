import bcrypt from 'bcryptjs';
import { getDB } from './db.js';
import { v4 as uuidv4 } from 'uuid';

const sql = getDB;

export async function hashPassword(password) {
  return await bcrypt.hash(password, 10);
}

export async function verifyPassword(password, hash) {
  return await bcrypt.compare(password, hash);
}

export async function createAdminUser(username, password, role = 'analyst') {
  const id = uuidv4();
  const passwordHash = bcrypt.hashSync(password, 10);
  
  try {
    await sql`
      INSERT INTO admin_users (id, username, password_hash, role)
      VALUES (${id}, ${username}, ${passwordHash}, ${role})
    `;
    
    return { success: true, id };
  } catch (error) {
    if (error.message.includes('duplicate key') || error.message.includes('unique')) {
      return { success: false, error: 'Utilisateur existe déjà' };
    }
    console.error('Create admin error:', error);
    return { success: false, error: error.message };
  }
}

export async function authenticateAdmin(username, password) {
  try {
    const result = await sql`
      SELECT * FROM admin_users WHERE username = ${username}
    `;
    
    const user = result[0];
    
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
  } catch (error) {
    console.error('Auth error:', error);
    return { success: false, error: error.message };
  }
}

export async function initializeDefaultAdmin() {
  try {
    const existing = await sql`
      SELECT * FROM admin_users WHERE username = ${process.env.ADMIN_DEFAULT_USERNAME || 'admin'}
    `;
    
    if (existing.length === 0) {
      const result = await createAdminUser(
        process.env.ADMIN_DEFAULT_USERNAME || 'admin',
        process.env.ADMIN_DEFAULT_PASSWORD || 'admin123',
        'admin'
      );
      
      if (result.success) {
        console.log('✓ Default admin user created');
      }
    }
  } catch (error) {
    console.error('Init admin error:', error);
  }
}

export function checkPermission(userRole, requiredRole) {
  const roles = ['analyst', 'moderator', 'admin'];
  const userLevel = roles.indexOf(userRole);
  const requiredLevel = roles.indexOf(requiredRole);
  
  return userLevel >= requiredLevel;
}
