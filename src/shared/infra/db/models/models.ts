// Drizzle ORM doesn't require model initialization like Sequelize
// All schemas are imported and used directly through the drizzle instance

export const initModels = async () => {
  // No initialization needed for Drizzle schemas
  console.log('Models initialized (Drizzle ORM)');
};
