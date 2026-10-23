// Food dishes have no stock count (a kitchen cooks to order). The database column stays, and every dish carries this
// large number, so the checkout's "enough stock" guard never stops an order and cancelling an order simply puts the
// portions back. Never show it to anyone.

export const FOOD_UNLIMITED_STOCK = 100000;
