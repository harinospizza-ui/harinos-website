import { Router } from 'express';
import { ResultSetHeader } from 'mysql2';
import { getMysqlPool } from '../db/mysql';
import { saveOrderSnapshotToPortableSsd } from '../storage/portableSsd';
import { CreateOrderRequest, OrderItemPayload } from '../types';

const router = Router();

const hasValidItem = (item: Partial<OrderItemPayload>): item is OrderItemPayload =>
  typeof item.id === 'string' &&
  typeof item.name === 'string' &&
  typeof item.quantity === 'number' &&
  typeof item.basePrice === 'number' &&
  typeof item.discountedPrice === 'number' &&
  typeof item.totalPrice === 'number';

const hasValidOrderPayload = (payload: Partial<CreateOrderRequest>): payload is CreateOrderRequest =>
  typeof payload.orderId === 'string' &&
  Array.isArray(payload.items) &&
  payload.items.every((item) => hasValidItem(item)) &&
  typeof payload.total === 'number' &&
  typeof payload.orderType === 'string' &&
  typeof payload.deliveryFee === 'number' &&
  typeof payload.location === 'string' &&
  typeof payload.createdAt === 'string' &&
  !!payload.outlet &&
  typeof payload.outlet.id === 'string' &&
  typeof payload.outlet.name === 'string' &&
  typeof payload.outlet.address === 'string' &&
  typeof payload.outlet.phone === 'string';

router.post('/orders', async (req, res) => {
  const payload = req.body as Partial<CreateOrderRequest>;

  if (!hasValidOrderPayload(payload)) {
    res.status(400).json({ success: false, message: 'Invalid order payload.' });
    return;
  }

  const connection = await getMysqlPool().getConnection();

  try {
    await connection.beginTransaction();

    const [orderInsertResult] = await connection.execute<ResultSetHeader>(
      `
        INSERT INTO orders
          (order_id, outlet_id, outlet_name, outlet_address, outlet_phone, order_type, total, delivery_fee, distance_km, customer_location_url, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        payload.orderId,
        payload.outlet.id,
        payload.outlet.name,
        payload.outlet.address,
        payload.outlet.phone,
        payload.orderType,
        payload.total,
        payload.deliveryFee,
        payload.distanceKm,
        payload.location,
        payload.createdAt,
      ],
    );

    for (const item of payload.items) {
      await connection.execute(
        `
          INSERT INTO order_items
            (order_row_id, menu_item_id, item_name, selected_size, quantity, base_price, discounted_price, total_price, applied_offer_id, applied_offer_title, is_offer_bonus)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          orderInsertResult.insertId,
          item.id,
          item.name,
          item.selectedSize ?? null,
          item.quantity,
          item.basePrice,
          item.discountedPrice,
          item.totalPrice,
          item.appliedOfferId ?? null,
          item.appliedOfferTitle ?? null,
          item.isOfferBonus ? 1 : 0,
        ],
      );
    }

    await connection.commit();

    const snapshotPath = await saveOrderSnapshotToPortableSsd(payload);

    res.status(201).json({
      success: true,
      orderId: payload.orderId,
      snapshotPath,
    });
  } catch (error) {
    await connection.rollback();
    console.error('Failed to store order:', error);
    res.status(500).json({ success: false, message: 'Failed to store order.' });
  } finally {
    connection.release();
  }
});

export default router;
