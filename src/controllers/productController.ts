import { Request, Response } from 'express';
import Product from '../models/Product';

function getPagination(query: Record<string, string | string[] | undefined>) {
  const page = parseInt(String(query.page || '1'), 10);
  const limit = parseInt(String(query.limit || '20'), 10);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

export async function getProducts(req: Request, res: Response): Promise<void> {
  try {
    const { page, limit, skip } = getPagination(req.query as Record<string, string>);
    const { category, search, isActive } = req.query as Record<string, string>;

    const filter: Record<string, unknown> = {};
    if (category) filter.category = category;
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (search) filter.name = { $regex: search, $options: 'i' };

    const [products, total] = await Promise.all([
      Product.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 }),
      Product.countDocuments(filter),
    ]);

    res.json({ products, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch {
    res.status(500).json({ error: 'Error al obtener productos' });
  }
}

export async function getProduct(req: Request, res: Response): Promise<void> {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) { res.status(404).json({ error: 'Producto no encontrado' }); return; }
    res.json(product);
  } catch {
    res.status(500).json({ error: 'Error al obtener producto' });
  }
}

export async function createProduct(req: Request, res: Response): Promise<void> {
  try {
    const product = await Product.create(req.body);
    res.status(201).json(product);
  } catch (err: unknown) {
    res.status(500).json({ error: 'Error al crear producto', details: String(err) });
  }
}

export async function updateProduct(req: Request, res: Response): Promise<void> {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!product) { res.status(404).json({ error: 'Producto no encontrado' }); return; }
    res.json(product);
  } catch {
    res.status(500).json({ error: 'Error al actualizar producto' });
  }
}

export async function deleteProduct(req: Request, res: Response): Promise<void> {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) { res.status(404).json({ error: 'Producto no encontrado' }); return; }
    res.json({ message: 'Producto eliminado' });
  } catch {
    res.status(500).json({ error: 'Error al eliminar producto' });
  }
}

export async function toggleProductStatus(req: Request, res: Response): Promise<void> {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) { res.status(404).json({ error: 'Producto no encontrado' }); return; }
    product.isActive = !product.isActive;
    await product.save();
    res.json(product);
  } catch {
    res.status(500).json({ error: 'Error al cambiar estado del producto' });
  }
}
