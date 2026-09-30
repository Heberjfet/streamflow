// Schemas de validación de requests (Fastify / JSON Schema).
// Nota: solo se validan entradas (body, params, querystring); no se definen
// schemas de respuesta para no filtrar campos por error.

export const registerSchema = {
  body: {
    type: 'object',
    required: ['email', 'password', 'name'],
    properties: {
      email: { type: 'string', minLength: 3 },
      password: { type: 'string', minLength: 8 },
      name: { type: 'string', minLength: 1 }
    }
  }
};

export const loginSchema = {
  body: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: { type: 'string', minLength: 3 },
      password: { type: 'string', minLength: 1 }
    }
  }
};

export const assetListSchema = {
  querystring: {
    type: 'object',
    properties: {
      page: { type: 'integer', minimum: 1 },
      limit: { type: 'integer', minimum: 1 },
      categoryId: { type: 'string' },
      status: { type: 'string' }
    }
  }
};

export const createAssetSchema = {
  body: {
    type: 'object',
    required: ['title'],
    properties: {
      title: { type: 'string', minLength: 1 },
      description: { type: 'string' },
      categoryId: { type: 'string' }
    }
  }
};

export const updateAssetSchema = {
  body: {
    type: 'object',
    properties: {
      title: { type: 'string', minLength: 1 },
      description: { type: 'string' },
      categoryId: { type: 'string' },
      categoryIds: { type: 'array', items: { type: 'string' } }
    }
  }
};

export const assetParamsSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string' }
    }
  }
};

export const uploadUrlSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string' }
    }
  },
  body: {
    type: 'object',
    required: ['filename', 'contentType'],
    properties: {
      filename: { type: 'string', minLength: 1 },
      contentType: { type: 'string', minLength: 1 }
    }
  }
};

export const categoryCreateSchema = {
  body: {
    type: 'object',
    required: ['name'],
    properties: {
      name: { type: 'string', minLength: 1 },
      description: { type: 'string' }
    }
  }
};

export const categoryUpdateSchema = {
  body: {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 1 },
      description: { type: 'string' }
    }
  }
};

export const categoryParamsSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string' }
    }
  }
};
