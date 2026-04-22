import dotenv from 'dotenv';
dotenv.config({ override: true });
import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import 'express-async-errors';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

// Debug: Check if DATABASE_URL is loaded
if (process.env.DATABASE_URL) {
  try {
    const parts = process.env.DATABASE_URL.split('@');
    if (parts.length > 1) {
      const hostPart = parts[1].split('/')[0];
      console.log(`Prisma Config: Attempting to connect to ${hostPart}`);
    }
  } catch (e) {
    console.log("Prisma: DATABASE_URL is defined but could not be parsed for logging.");
  }
} else {
  console.error("Prisma: DATABASE_URL is UNDEFINED in process.env");
}

const JWT_SECRET = process.env.JWT_SECRET || 'reirakits-secret-key-2024';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Static files for uploads
  const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  app.use('/uploads', express.static(uploadsDir));

  // Multer config
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, uniqueSuffix + path.extname(file.originalname));
    }
  });
  const upload = multer({ storage });

  // Auth Middleware
  const authenticate = async (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Não autorizado: Token ausente ou malformatado' });
    }

    const token = authHeader.split(' ')[1];

    try {
      const decoded: any = jwt.verify(token, JWT_SECRET);
      
      // Attempt to find user with a timeout or catch DB errors specifically
      try {
        const user = await prisma.user.findUnique({ where: { id: decoded.id } });
        if (!user) return res.status(401).json({ error: 'Usuário não encontrado' });
        req.user = user;
        next();
      } catch (dbErr: any) {
        console.error('Auth Database Error:', dbErr.message);
        if (dbErr.code === 'P1001' || dbErr.message.includes('Can\'t reach database')) {
          return res.status(503).json({ error: 'Serviço temporariamente indisponível: Falha na conexão com o banco de dados' });
        }
        return res.status(500).json({ error: 'Erro interno ao processar autenticação' });
      }
    } catch (err: any) {
      console.error('JWT Verification Error:', err.message);
      return res.status(401).json({ error: 'Token inválido ou expirado' });
    }
  };

  // Admin Middleware
  const isAdmin = (req: any, res: any, next: any) => {
    if (req.user.tipo !== 'ADMIN') {
      return res.status(403).json({ error: 'Acesso negado: Apenas administradores' });
    }
    next();
  };

  // Helper for Slugs
  const generateSlug = (text: string) => {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, "") // Remove accents
      .replace(/[^\w\s-]/g, "") // Remove symbols
      .replace(/[\s_]+/g, "-") // Replace spaces/underscores with -
      .replace(/^-+|-+$/g, ""); // Trim dashes
  };

  // Helper for Normalizing CPF
  const cleanCPF = (cpf: string) => {
    const cleaned = cpf ? String(cpf).replace(/\D/g, '') : '';
    return cleaned.length > 0 ? cleaned : undefined;
  };

  // --- API Routes ---

  app.get('/api/entregas/recentes', authenticate, async (req, res) => {
    try {
      const recentRequests = await prisma.deliveryRequest.findMany({
        where: {
          status: {
            in: ['PENDENTE', 'EM_SEPARACAO']
          }
        },
        include: {
          participant: true,
          event: {
            select: { nome: true }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 50
      });
      res.json(recentRequests);
    } catch (err) {
      res.status(500).json({ error: 'Erro ao buscar entregas recentes' });
    }
  });

  app.post('/api/entregas/:id/separar', authenticate, async (req: any, res) => {
    const { id } = req.params;
    const deliveryRequest = await prisma.deliveryRequest.findUnique({ where: { id } });
    if (!deliveryRequest) return res.status(404).json({ error: 'Pedido não encontrado' });

    if (deliveryRequest.status === 'EM_SEPARACAO' && deliveryRequest.atendenteNome !== req.user.nome) {
      return res.status(400).json({ error: 'Este kit já está sendo separado por outro atendente' });
    }

    const updated = await prisma.deliveryRequest.update({
      where: { id },
      data: {
        status: 'EM_SEPARACAO',
        atendenteNome: req.user.nome
      }
    });
    res.json(updated);
  });

  app.post('/api/entregas/:id/cancelar', authenticate, async (req: any, res) => {
    const { id } = req.params;
    const deliveryRequest = await prisma.deliveryRequest.findUnique({ where: { id } });
    if (!deliveryRequest) return res.status(404).json({ error: 'Pedido não encontrado' });

    if (deliveryRequest.status === 'ENTREGUE') {
      return res.status(400).json({ error: 'Entrega já finalizada' });
    }

    const updated = await prisma.deliveryRequest.update({
      where: { id },
      data: {
        status: 'PENDENTE',
        atendenteNome: null
      }
    });
    res.json(updated);
  });

  app.post('/api/entregas/:id/confirmar', authenticate, async (req, res) => {
    const { id } = req.params;
    
    const deliveryRequest = await prisma.deliveryRequest.findUnique({ 
      where: { id },
      include: { participant: true }
    });

    if (!deliveryRequest) return res.status(404).json({ error: 'Pedido não encontrado' });

    // Transaction to update both
    const [updatedRequest] = await prisma.$transaction([
      prisma.deliveryRequest.update({
        where: { id },
        data: { status: 'ENTREGUE' }
      }),
      prisma.participant.update({
        where: { id: deliveryRequest.participantId },
        data: { 
          status: 'ENTREGUE',
          entregueAt: new Date()
        }
      })
    ]);

    res.json(updatedRequest);
  });

  // Public: Totem Access
  app.get('/api/totem/:slug', async (req, res) => {
    const { slug } = req.params;
    const event = await prisma.event.findUnique({
      where: { slug },
      select: { id: true, nome: true, dataEvento: true, local: true, imageUrl: true }
    });
    if (!event) return res.status(404).json({ error: 'Evento não encontrado' });
    res.json(event);
  });

  app.get('/api/totem/:slug/participantes/buscar', async (req, res) => {
    const { slug } = req.params;
    const { search } = req.query;

    if (!search || String(search).length < 2) {
      return res.json([]);
    }

    const event = await prisma.event.findUnique({ where: { slug } });
    if (!event) return res.status(404).json({ error: 'Evento não encontrado' });

    const cpfFilter = cleanCPF(String(search));
    const where: any = {
      eventId: event.id,
      OR: [
        { nome: { contains: String(search) } }
      ]
    };

    if (cpfFilter) {
      where.OR.push({ cpf: { contains: cpfFilter } });
    }

    const participants = await prisma.participant.findMany({
      where,
      take: 10,
      orderBy: { nome: 'asc' }
    });

    res.json(participants);
  });

  app.post('/api/participantes/:id/entregar', async (req, res) => {
    const { id } = req.params;
    
    // In Totem mode, we trust IDs but we check if record exists
    const participant = await prisma.participant.findUnique({ where: { id } });
    if (!participant) return res.status(404).json({ error: 'Participante não encontrado' });

    if (participant.status === 'ENTREGUE') {
      return res.status(400).json({ error: 'Este kit já foi entregue anteriormente' });
    }

    // Check for active delivery request
    const existingRequest = await prisma.deliveryRequest.findFirst({
      where: {
        participantId: id,
        status: { in: ['PENDENTE', 'EM_SEPARACAO'] }
      }
    });

    if (existingRequest) {
      return res.status(400).json({ error: 'Já existe uma solicitação de retirada ativa para este participante' });
    }

    const newRequest = await prisma.deliveryRequest.create({
      data: {
        participantId: id,
        eventId: participant.eventId,
        status: 'PENDENTE'
      }
    });

    res.json(newRequest);
  });

  // Public: Login
  app.post('/api/auth/login', async (req, res) => {
    const { email, senha } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !(await bcrypt.compare(senha, user.senha))) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    if (user.status === 'INATIVO') {
      return res.status(403).json({ error: 'Esta conta está desativada' });
    }

    const token = jwt.sign({ id: user.id, email: user.email, tipo: user.tipo }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, nome: user.nome, email: user.email, tipo: user.tipo } });
  });

  // Protected: Me
  app.get('/api/auth/me', authenticate, (req: any, res) => {
    res.json({ user: { id: req.user.id, nome: req.user.nome, email: req.user.email, tipo: req.user.tipo, status: req.user.status } });
  });

  // Admin: Manage Organizers
  app.get('/api/admin/organizadores', authenticate, isAdmin, async (req, res) => {
    const organizers = await prisma.user.findMany({
      where: { tipo: 'ORGANIZADOR' },
      orderBy: { createdAt: 'desc' }
    });
    res.json(organizers);
  });

  app.post('/api/admin/organizadores', authenticate, isAdmin, async (req, res) => {
    const { nome, email, senha } = req.body;
    
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(400).json({ error: 'Email já cadastrado' });

    const hashedPassword = await bcrypt.hash(senha, 10);
    const user = await prisma.user.create({
      data: {
        nome,
        email,
        senha: hashedPassword,
        tipo: 'ORGANIZADOR',
        status: 'ATIVO'
      }
    });

    res.status(201).json(user);
  });

  app.patch('/api/admin/organizadores/:id', authenticate, isAdmin, async (req, res) => {
    const { id } = req.params;
    const { nome, email, status } = req.body;

    const user = await prisma.user.update({
      where: { id },
      data: { nome, email, status }
    });

    res.json(user);
  });

  // --- Dashboard API ---
  
  app.get('/api/organizador/dashboard', authenticate, async (req: any, res) => {
    try {
      const userEvents = await prisma.event.findMany({
        where: req.user.tipo === 'ADMIN' ? {} : { organizadorId: req.user.id },
        select: { id: true }
      });
      const eventIds = userEvents.map(e => e.id);

      const totalInscritos = await prisma.participant.count({
        where: { eventId: { in: eventIds } }
      });

      const totalEntregues = await prisma.participant.count({
        where: { 
          eventId: { in: eventIds },
          status: 'ENTREGUE'
        }
      });

      const activeRequests = await prisma.deliveryRequest.findMany({
        where: {
          eventId: { in: eventIds },
          status: { in: ['PENDENTE', 'EM_SEPARACAO'] }
        },
        include: {
          participant: { select: { nome: true } },
          event: { select: { nome: true } }
        },
        orderBy: { createdAt: 'desc' }
      });

      const recentDeliveries = await prisma.participant.findMany({
        where: {
          eventId: { in: eventIds },
          status: 'ENTREGUE'
        },
        select: {
          id: true,
          nome: true,
          entregueAt: true
        },
        orderBy: { entregueAt: 'desc' },
        take: 10
      });

      res.json({
        stats: {
          totalInscritos,
          totalEntregues,
          totalPendentes: totalInscritos - totalEntregues
        },
        activeRequests,
        recentDeliveries
      });
    } catch (err) {
      res.status(500).json({ error: 'Erro ao carregar dashboard' });
    }
  });

  // --- Paginated Participants for Reports ---
  app.get('/api/organizador/participantes', authenticate, async (req: any, res) => {
    try {
      const { user } = req;
      const { page = 1, limit = 25, search = '', eventId = 'all' } = req.query;
      
      const skip = (Number(page) - 1) * Number(limit);
      const take = Number(limit);

      // Get events accessible by the user
      const userEvents = await prisma.event.findMany({
        where: user.tipo === 'ADMIN' ? {} : { organizadorId: user.id },
        select: { id: true }
      });
      const accessibleEventIds = userEvents.map(e => e.id);

      const where: any = {
        eventId: eventId === 'all' ? { in: accessibleEventIds } : eventId,
      };

      if (eventId !== 'all' && !accessibleEventIds.includes(eventId as string)) {
        return res.status(403).json({ error: 'Acesso negado a este evento' });
      }

      if (search) {
        const cpfFilter = cleanCPF(String(search));
        where.OR = [
          { nome: { contains: String(search) } }
        ];
        if (cpfFilter) {
          where.OR.push({ cpf: { contains: cpfFilter } });
        }
      }

      const [total, participants] = await Promise.all([
        prisma.participant.count({ where }),
        prisma.participant.findMany({
          where,
          include: {
            event: { select: { nome: true } },
            deliveryRequests: { select: { id: true } }
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take
        })
      ]);

      res.json({
        participants: participants.map(p => ({
          ...p,
          eventName: p.event.nome
        })),
        total,
        pages: Math.ceil(total / take)
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao buscar participantes paginados' });
    }
  });

  // --- Events API ---
  
  app.get('/api/eventos', authenticate, async (req: any, res) => {
    try {
      const { user } = req;
      let events;
      
      if (user.tipo === 'ADMIN') {
        events = await prisma.event.findMany({
          include: { organizador: { select: { nome: true, email: true } } },
          orderBy: { createdAt: 'desc' }
        });
      } else {
        events = await prisma.event.findMany({
          where: { organizadorId: user.id },
          orderBy: { createdAt: 'desc' }
        });
      }
      
      res.json(events);
    } catch (err) {
      res.status(500).json({ error: 'Erro ao buscar eventos' });
    }
  });

  app.post('/api/eventos', authenticate, async (req: any, res) => {
    try {
      const { user } = req;
      if (user.tipo !== 'ORGANIZADOR') {
        return res.status(403).json({ error: 'Apenas organizadores podem criar eventos' });
      }

      const { nome, descricao, dataEvento, local, imageUrl } = req.body;
      
      const event = await prisma.event.create({
        data: {
          nome,
          slug: generateSlug(`${nome}-${Date.now()}`),
          descricao,
          dataEvento: new Date(dataEvento),
          local,
          imageUrl,
          organizadorId: user.id
        }
      });
      
      res.status(201).json(event);
    } catch (err) {
      res.status(500).json({ error: 'Erro ao criar evento' });
    }
  });

  app.put('/api/eventos/:id', authenticate, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { user } = req;
      const { nome, descricao, dataEvento, local, status, imageUrl } = req.body;

      // Check ownership
      const existingEvent = await prisma.event.findUnique({ where: { id } });
      if (!existingEvent) {
        return res.status(404).json({ error: 'Evento não encontrado' });
      }

      if (user.tipo !== 'ADMIN' && existingEvent.organizadorId !== user.id) {
        return res.status(403).json({ error: 'Acesso negado: Este evento não pertence a você' });
      }

      const event = await prisma.event.update({
        where: { id },
        data: {
          nome,
          slug: nome ? generateSlug(`${nome}-${existingEvent.id.split('-')[0]}`) : undefined,
          descricao,
          dataEvento: dataEvento ? new Date(dataEvento) : undefined,
          local,
          status,
          imageUrl
        }
      });
      
      res.json(event);
    } catch (err) {
      res.status(500).json({ error: 'Erro ao atualizar evento' });
    }
  });

  app.delete('/api/eventos/:id', authenticate, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { user } = req;

      // Check ownership and get image path
      const existingEvent = await prisma.event.findUnique({ where: { id } });
      if (!existingEvent) {
        return res.status(404).json({ error: 'Evento não encontrado' });
      }

      if (user.tipo !== 'ADMIN' && existingEvent.organizadorId !== user.id) {
        return res.status(403).json({ error: 'Acesso negado: Este evento não pertence a você' });
      }

      // Delete image if exists
      if (existingEvent.imageUrl) {
        try {
          const fileName = existingEvent.imageUrl.split('/').pop();
          if (fileName) {
            const filePath = path.join(process.cwd(), 'public', 'uploads', fileName);
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
            }
          }
        } catch (fileErr) {
          console.error('Error deleting image file:', fileErr);
        }
      }

      await prisma.event.delete({ where: { id } });
      
      res.json({ message: 'Evento removido com sucesso' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao remover evento' });
    }
  });

  app.post('/api/upload', authenticate, upload.single('image'), (req: any, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }
    const imageUrl = `/uploads/${req.file.filename}`;
    res.json({ imageUrl });
  });

  // --- Participants API ---

  // Helper to check event access
  const checkEventAccess = async (eventId: string, user: any) => {
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) return { status: 404, error: 'Evento não encontrado' };
    if (user.tipo !== 'ADMIN' && event.organizadorId !== user.id) {
      return { status: 403, error: 'Acesso negado: Este evento não pertence a você' };
    }
    return { event };
  };

  app.get('/api/eventos/:id/participantes', authenticate, async (req: any, res) => {
    const { id } = req.params;
    const { search } = req.query;
    
    const access: any = await checkEventAccess(id, req.user);
    if (access.error) return res.status(access.status).json({ error: access.error });

    const where: any = { eventId: id };
    if (search) {
      const cpfFilter = cleanCPF(String(search));
      where.OR = [
        { nome: { contains: String(search) } }
      ];
      if (cpfFilter) {
        where.OR.push({ cpf: { contains: cpfFilter } });
      }
    }

    const participants = await prisma.participant.findMany({
      where,
      include: {
        deliveryRequests: {
          select: { id: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(participants);
  });

  app.post('/api/eventos/:id/participantes', authenticate, async (req: any, res) => {
    const { id } = req.params;
    const { nome, email, cpf: rawCpf, telefone } = req.body;

    if (!nome || !rawCpf) {
      return res.status(400).json({ error: 'Nome e CPF são obrigatórios' });
    }

    const cpf = cleanCPF(rawCpf);
    const access: any = await checkEventAccess(id, req.user);
    if (access.error) return res.status(access.status).json({ error: access.error });

    // Check CPF unique per event
    const existing = await prisma.participant.findUnique({
      where: { cpf_eventId: { cpf, eventId: id } }
    });
    if (existing) {
      return res.status(400).json({ error: 'CPF já cadastrado neste evento' });
    }

    const participant = await prisma.participant.create({
      data: {
        nome,
        email,
        cpf,
        telefone,
        eventId: id
      }
    });

    res.status(201).json(participant);
  });

  app.patch('/api/participantes/:id/status', authenticate, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const { user } = req;

      const participant = await prisma.participant.findUnique({
        where: { id },
        include: { event: true }
      });

      if (!participant) return res.status(404).json({ error: 'Participante não encontrado' });
      
      if (user.tipo !== 'ADMIN' && participant.event.organizadorId !== user.id) {
        return res.status(403).json({ error: 'Acesso negado' });
      }

      const updated = await prisma.participant.update({
        where: { id },
        data: { 
          status,
          entregueAt: status === 'ENTREGUE' ? new Date() : null
        }
      });

      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: 'Erro ao atualizar status' });
    }
  });

  app.delete('/api/participantes/:id', authenticate, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { user } = req;

      const participant = await prisma.participant.findUnique({
        where: { id },
        include: { event: true }
      });

      if (!participant) return res.status(404).json({ error: 'Participante não encontrado' });
      
      if (user.tipo !== 'ADMIN' && participant.event.organizadorId !== user.id) {
        return res.status(403).json({ error: 'Acesso negado' });
      }

      await prisma.participant.delete({ where: { id } });
      res.json({ message: 'Participante removido' });
    } catch (err) {
      res.status(500).json({ error: 'Erro ao remover participante' });
    }
  });

  app.post('/api/eventos/:id/participantes/importar', authenticate, async (req: any, res) => {
    const { id } = req.params;
    const { csvContent } = req.body;

    if (!csvContent) {
      return res.status(400).json({ error: 'Conteúdo CSV não fornecido' });
    }

    const access: any = await checkEventAccess(id, req.user);
    if (access.error) return res.status(access.status).json({ error: access.error });

    const lines = csvContent.split('\n').map((l: string) => l.trim()).filter((l: string) => l);
    if (lines.length < 2) {
      return res.status(400).json({ error: 'CSV vazio ou sem dados' });
    }

    // 1. Fetch all existing CPFs for this event to avoid duplicates in memory
    const existingParticipants = await prisma.participant.findMany({
      where: { eventId: id },
      select: { cpf: true }
    });
    const existingCpfs = new Set(existingParticipants.map(p => p.cpf));

    const toInsert: any[] = [];
    const ignoredList: { row: number; nome: string; reason: string }[] = [];
    const cpfsInCsv = new Set<string>();

    // 2. Validate in memory
    for (let i = 1; i < lines.length; i++) {
      const columns = lines[i].split(',').map((c: string) => c.trim());
      
      if (columns.length < 2) { 
        ignoredList.push({ row: i + 1, nome: 'Linha inválida', reason: 'Colunas insuficientes' });
        continue;
      }

      const [
        nome, rawCpf, dataNascimento, sexo, equipe, cidade, 
        modalidade, numeroPeito, chip, kit, 
        tamanhoCamiseta, statusInCsv
      ] = columns;

      if (!nome || !rawCpf) {
        ignoredList.push({ row: i + 1, nome: nome || 'Sem nome', reason: 'Nome ou CPF ausente' });
        continue;
      }

      const cpf = cleanCPF(rawCpf);

      // Check internal CSV duplicates
      if (cpfsInCsv.has(cpf)) {
        ignoredList.push({ row: i + 1, nome, reason: 'CPF duplicado no arquivo' });
        continue;
      }
      cpfsInCsv.add(cpf);

      // Check database duplicates
      if (existingCpfs.has(cpf)) {
        ignoredList.push({ row: i + 1, nome, reason: 'Participante já cadastrado neste evento' });
        continue;
      }

      let status: "INSCRITO" | "ENTREGUE" = "INSCRITO";
      const s = statusInCsv?.toLowerCase();
      if (s === 'entregue' || s === 'sim' || s === '1') {
        status = "ENTREGUE";
      }

      toInsert.push({
        nome,
        cpf,
        dataNascimento: dataNascimento || null,
        sexo: sexo || null,
        equipe: equipe || null,
        cidade: cidade || null,
        modalidade: modalidade || null,
        numeroPeito: numeroPeito || null,
        chip: chip || null,
        kit: kit || null,
        tamanhoCamiseta: tamanhoCamiseta || null,
        status,
        eventId: id
      });
    }

    // 3. Batch insertion
    let importedCount = 0;
    if (toInsert.length > 0) {
      const result = await prisma.participant.createMany({
        data: toInsert,
        skipDuplicates: true
      });
      importedCount = result.count;
    }

    res.json({
      totalProcessed: lines.length - 1,
      imported: importedCount,
      ignored: ignoredList.length,
      errors: 0, // Errors are grouped in ignored for simplicity
      ignoredList
    });
  });

  // GET Event Details
  app.get('/api/eventos/:id', authenticate, async (req: any, res) => {
    const { id } = req.params;
    const access: any = await checkEventAccess(id, req.user);
    if (access.error) return res.status(access.status).json({ error: access.error });
    res.json(access.event);
  });

  // --- Vite / Static Assets ---

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      // If it's an API request that fell through, return JSON instead of HTML
      if (req.path.startsWith('/api/')) {
        console.warn(`API Route not found: ${req.method} ${req.path}`);
        return res.status(404).json({ error: `Rota da API não encontrada: ${req.path}` });
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', async () => {
    console.log(`Server running on http://localhost:${PORT}`);
    
    // Run Migrations & Seed in the background
    try {
      await prisma.$connect();
      console.log('Database connection: SUCCESS (MySQL)');

      // Admin Seed
      const adminExists = await prisma.user.findFirst({ where: { tipo: 'ADMIN' } });
      if (!adminExists) {
        const hashedPassword = await bcrypt.hash('admin123', 10);
        await prisma.user.create({
          data: {
            nome: 'Administrador Sistema',
            email: 'admin@reirakits.com',
            senha: hashedPassword,
            tipo: 'ADMIN',
            status: 'ATIVO'
          }
        });
        console.log('Seed: Admin user created (admin@reirakits.com / admin123)');
      }

      // Migration: Normalize existing CPFs (One query is faster)
      try {
        const normalizedCount = await prisma.$executeRaw`
          UPDATE Participant 
          SET cpf = REPLACE(REPLACE(cpf, '.', ''), '-', '') 
          WHERE cpf LIKE '%.%' OR cpf LIKE '%-%'
        `;
        if (normalizedCount > 0) {
          console.log(`Migration: Normalized ${normalizedCount} CPFs via SQL.`);
        }
      } catch (sqlErr) {
        // Fallback to loop if SQL fails for any reason
        const participantsWithFormattedCpf = await prisma.participant.findMany({
          where: {
            OR: [
              { cpf: { contains: '.' } },
              { cpf: { contains: '-' } }
            ]
          },
          select: { id: true, cpf: true }
        });

        if (participantsWithFormattedCpf.length > 0) {
          console.log(`Migration: Normalizing ${participantsWithFormattedCpf.length} CPFs via Loop (Fallback)...`);
          for (const p of participantsWithFormattedCpf) {
            const cleaned = p.cpf.replace(/\D/g, '');
            if (cleaned) {
              await prisma.participant.update({
                where: { id: p.id },
                data: { cpf: cleaned }
              });
            }
          }
          console.log('Migration: CPFs normalized successfully.');
        }
      }

      // Migration: Populate slugs for existing events
      const eventsWithoutSlug = await prisma.event.findMany({ where: { slug: null } });
      if (eventsWithoutSlug.length > 0) {
        console.log(`Migration: Populating slugs for ${eventsWithoutSlug.length} events...`);
        for (const event of eventsWithoutSlug) {
          const slug = generateSlug(`${event.nome}-${event.id.split('-')[0]}`);
          await prisma.event.update({
            where: { id: event.id },
            data: { slug }
          });
        }
        console.log('Migration: Slugs populated successfully.');
      }
    } catch (migErr) {
      console.error('Migration background process error:', migErr);
    }
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
