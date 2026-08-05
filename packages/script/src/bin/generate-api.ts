import APIGenerator from '../generator/APIGenerator';

await APIGenerator.init()
  .withBarrel('../../../packages/api/src/generated')
  .generate();

process.exit();
