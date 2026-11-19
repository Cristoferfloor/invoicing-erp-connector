import { DynamicModule, Inject, Module, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { MongoClient } from 'mongodb';

import { LeerErpService } from './application/leer-erp.service';
import { CONFIGURACION_PROGRAMADOR, ProgramadorLecturasService } from './application/programador-lecturas.service';
import { COMPROBANTES_PORT, CONFIGURACION_PORT, ERP_PORT, LECTURAS_PORT } from './domain/puertos';
import { HttpErpAdapter } from './infrastructure/erp/http-erp.adapter';
import { HttpConfiguracionAdapter } from './infrastructure/configuracion/http-configuracion.adapter';
import { MongoComprobantesRepository, MongoLecturasRepository } from './infrastructure/mongo/mongo.repositorios';
import { LecturasController } from './infrastructure/rest/lecturas.controller';
import { SaludController } from './infrastructure/rest/salud.controller';
import { TOKEN_ADMIN, TokenAdminGuard } from './infrastructure/rest/token-admin.guard';

const MONGO = Symbol('MONGO');

@Module({})
export class AppModule implements OnModuleInit, OnApplicationShutdown {
  constructor(
    @Inject(MONGO) private readonly mongo: MongoClient,
    @Inject(COMPROBANTES_PORT) private readonly comprobantes: MongoComprobantesRepository,
  ) {}

  static registrar(env: NodeJS.ProcessEnv): DynamicModule {
    for (const variable of ['ERP_CONNECTOR_MONGO_URL', 'ERP_CONNECTOR_ADMIN_TOKEN', 'CONFIG_URL', 'CONFIG_ADMIN_TOKEN']) {
      if (!env[variable]) throw new Error(`Falta ${variable}.`);
    }
    const mongo = new MongoClient(env.ERP_CONNECTOR_MONGO_URL!);
    const db = mongo.db('invoicing');

    return {
      module: AppModule,
      controllers: [LecturasController, SaludController],
      providers: [
        LeerErpService,
        ProgramadorLecturasService,
        TokenAdminGuard,
        { provide: MONGO, useValue: mongo },
        { provide: TOKEN_ADMIN, useValue: env.ERP_CONNECTOR_ADMIN_TOKEN },
        { provide: ERP_PORT, useValue: new HttpErpAdapter(Number(env.ERP_TIMEOUT_MS ?? 60000)) },
        { provide: CONFIGURACION_PORT, useValue: new HttpConfiguracionAdapter(env.CONFIG_URL!, env.CONFIG_ADMIN_TOKEN!) },
        { provide: COMPROBANTES_PORT, useValue: new MongoComprobantesRepository(db) },
        { provide: LECTURAS_PORT, useValue: new MongoLecturasRepository(db) },
        {
          provide: CONFIGURACION_PROGRAMADOR,
          useValue: {
            pulsoMs: Number(env.PULSE_MS ?? 5000),
            refrescoConexionesMs: Number(env.CONNECTIONS_REFRESH_MS ?? 60000),
          },
        },
      ],
    };
  }

  async onModuleInit(): Promise<void> {
    await this.mongo.connect();
    await this.comprobantes.prepararIndices();
  }

  async onApplicationShutdown(): Promise<void> {
    await this.mongo.close();
  }
}
