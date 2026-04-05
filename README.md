# Microservicio de Pedidos

- **Dominio**: Order, Price, SKU, Quantity, eventos de dominio.
- **Application**: Casos de uso CreateOrder, AddItemToOrder, puertos y DTOs.
- **Infra**: repositorio InMemory, pricing estático, event bus no-op.
- **HTTP**: endpoints mínimos con Fastify.
- **Composition**: container.ts como composition root.
- **Tests**: domino + aceptación de casos de uso con Vitest.

## Comportamiento

- `POST /orders` crea un pedido.
- `POST /orders/:orderId/items` agrega una línea (SKU + quantity) con precio actual.
- Devuelve el total del pedido
