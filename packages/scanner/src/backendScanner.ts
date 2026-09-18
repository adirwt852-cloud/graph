import * as parser from '@babel/parser';
import traversePkg from '@babel/traverse';
import * as fs from 'fs';
import * as path from 'path';
import { GraphNode } from '../../graph-builder/src/types';

// Workaround for Babel traverse ESM import
const traverse = (traversePkg as any).default || traversePkg;

export interface BackendRouteInfo {
  method: string;
  path: string;
  fullPath: string;
  file: string;
  line: number;
  endLine?: number;
  handlerName?: string;
  servicesCalled: Array<{
    serviceName: string;
    methodName: string;
    file?: string;
    line: number;
  }>;
  responseShape?: Record<string, string>;
  codeSnippet?: string;
}

export interface BackendServiceInfo {
  name: string;
  methodName: string;
  file: string;
  line: number;
  endLine?: number;
  dbCalls: Array<{
    dbAccessName: string; // e.g. "db.users.findOne"
    patternType: string;
    line: number;
    collectionOrTable?: string;
    operation?: string;
  }>;
  otherServicesCalled: Array<{
    serviceName: string;
    methodName: string;
    line: number;
  }>;
  responseShape?: Record<string, string>;
  codeSnippet?: string;
}

export interface BackendScanResult {
  routes: BackendRouteInfo[];
  services: BackendServiceInfo[];
  dbAccessPoints: Array<{
    id: string;
    name: string;
    file: string;
    line: number;
    operation: string;
    target: string;
  }>;
  nodes: GraphNode[];
}

export interface ScannerConfig {
  dbCallPatterns?: string[]; // e.g. ['.findOne', '.find', '.insertOne', '.updateOne', '.deleteOne', '.query', 'db.']
  routePrefixes?: Record<string, string>; // Router variable / mount path e.g. { userRouter: '/api', orderRouter: '/api' }
}

const DEFAULT_DB_PATTERNS = [
  'findOne', 'find', 'insertOne', 'insertMany', 'updateOne', 'updateMany',
  'deleteOne', 'deleteMany', 'query', 'exec', 'save', 'countDocuments', 'aggregate'
];

export class BackendScanner {
  private config: Required<ScannerConfig>;

  constructor(config: ScannerConfig = {}) {
    this.config = {
      dbCallPatterns: config.dbCallPatterns || DEFAULT_DB_PATTERNS,
      routePrefixes: config.routePrefixes || { userRouter: '/api', orderRouter: '/api', router: '/api', app: '' }
    };
  }

  public scanDirectory(backendDir: string): BackendScanResult {
    const routes: BackendRouteInfo[] = [];
    const services: BackendServiceInfo[] = [];
    const dbAccessMap = new Map<string, { id: string; name: string; file: string; line: number; operation: string; target: string }>();

    const files = this.getAllFiles(backendDir).filter(f => f.endsWith('.ts') || f.endsWith('.js'));

    // 1. Scan Services
    for (const file of files) {
      if (file.includes('service') || file.includes('services')) {
        const fileServices = this.scanServiceFile(file);
        services.push(...fileServices);
      }
    }

    // 2. Scan Routes
    for (const file of files) {
      if (file.includes('route') || file.includes('routes') || file.includes('controller') || file.includes('server.ts') || file.includes('app.ts')) {
        const fileRoutes = this.scanRouteFile(file);
        routes.push(...fileRoutes);
      }
    }

    // 3. Collect DB Access Points
    for (const svc of services) {
      for (const dbCall of svc.dbCalls) {
        const dbId = `db:${dbCall.dbAccessName}`;
        if (!dbAccessMap.has(dbId)) {
          dbAccessMap.set(dbId, {
            id: dbId,
            name: dbCall.dbAccessName,
            file: svc.file,
            line: dbCall.line,
            operation: dbCall.operation || 'query',
            target: dbCall.collectionOrTable || 'database'
          });
        }
      }
    }

    // Convert into GraphNodes
    const nodes: GraphNode[] = [];

    // Route Nodes
    for (const route of routes) {
      nodes.push({
        id: `route:${route.method.toUpperCase()}:${route.fullPath}`,
        name: `${route.method.toUpperCase()} ${route.fullPath}`,
        label: `${route.method.toUpperCase()} ${route.fullPath}`,
        type: 'route',
        file: route.file,
        line: route.line,
        endLine: route.endLine,
        httpMethod: route.method.toUpperCase(),
        routePath: route.fullPath,
        handlerName: route.handlerName,
        responseShape: route.responseShape,
        codeSnippet: route.codeSnippet
      });
    }

    // Service Nodes
    for (const svc of services) {
      nodes.push({
        id: `service:${svc.name}:${svc.methodName}`,
        name: `${svc.name}.${svc.methodName}`,
        label: `${svc.name}.${svc.methodName}()`,
        type: 'service-function',
        file: svc.file,
        line: svc.line,
        endLine: svc.endLine,
        responseShape: svc.responseShape,
        codeSnippet: svc.codeSnippet
      });
    }

    // DB Access Point Nodes
    for (const db of dbAccessMap.values()) {
      nodes.push({
        id: db.id,
        name: db.name,
        label: db.name,
        type: 'db-access-point',
        file: db.file,
        line: db.line,
        metadata: {
          operation: db.operation,
          target: db.target
        }
      });
    }

    return {
      routes,
      services,
      dbAccessPoints: Array.from(dbAccessMap.values()),
      nodes
    };
  }

  private scanRouteFile(filePath: string): BackendRouteInfo[] {
    const code = fs.readFileSync(filePath, 'utf-8');
    const lines = code.split('\n');
    const routes: BackendRouteInfo[] = [];

    let ast: parser.ParseResult<parser.File>;
    try {
      ast = parser.parse(code, {
        sourceType: 'module',
        plugins: ['typescript', 'jsx']
      });
    } catch (e) {
      return routes;
    }

    // Map handler functions in the file
    const handlerMap = new Map<string, { line: number; servicesCalled: any[]; responseShape?: Record<string, string>; snippet: string }>();

    traverse(ast, {
      FunctionDeclaration: (nodePath: any) => {
        const funcName = nodePath.node.id?.name;
        if (funcName) {
          const loc = nodePath.node.loc;
          const snippet = loc ? lines.slice(loc.start.line - 1, loc.end.line).join('\n') : '';
          const servicesCalled = this.findServiceCallsInNode(nodePath);
          const responseShape = this.inferResponseShape(nodePath);
          handlerMap.set(funcName, {
            line: loc?.start.line || 1,
            servicesCalled,
            responseShape,
            snippet
          });
        }
      },
      VariableDeclarator: (nodePath: any) => {
        const varName = nodePath.node.id?.name;
        const init = nodePath.node.init;
        if (varName && (init?.type === 'ArrowFunctionExpression' || init?.type === 'FunctionExpression')) {
          const loc = nodePath.node.loc;
          const snippet = loc ? lines.slice(loc.start.line - 1, loc.end.line).join('\n') : '';
          const servicesCalled = this.findServiceCallsInNode(nodePath);
          const responseShape = this.inferResponseShape(nodePath);
          handlerMap.set(varName, {
            line: loc?.start.line || 1,
            servicesCalled,
            responseShape,
            snippet
          });
        }
      }
    });

    // Determine router mount prefix from filename or convention
    let prefix = '/api';
    const filename = path.basename(filePath).toLowerCase();
    if (filename.includes('user')) prefix = '/api';
    if (filename.includes('order')) prefix = '/api';

    traverse(ast, {
      CallExpression: (nodePath: any) => {
        const callee = nodePath.node.callee;
        // Check router.get, router.post, app.get, etc.
        if (
          callee.type === 'MemberExpression' &&
          callee.property &&
          callee.property.type === 'Identifier' &&
          ['get', 'post', 'put', 'delete', 'patch'].includes(callee.property.name)
        ) {
          const method = callee.property.name;
          const args = nodePath.node.arguments;
          if (args.length >= 2 && (args[0].type === 'StringLiteral' || args[0].type === 'TemplateLiteral')) {
            let routePath = '';
            if (args[0].type === 'StringLiteral') {
              routePath = args[0].value;
            } else if (args[0].type === 'TemplateLiteral') {
              routePath = args[0].quasis.map((q: any) => q.value.raw).join(':param');
            }

            // Clean full path
            const fullPath = routePath.startsWith('/api') ? routePath : `${prefix}${routePath.startsWith('/') ? routePath : `/${routePath}`}`;

            const handlerArg = args[args.length - 1];
            let handlerName = 'anonymousHandler';
            let servicesCalled: any[] = [];
            let responseShape: Record<string, string> | undefined;
            let handlerLine = nodePath.node.loc?.start.line || 1;

            if (handlerArg.type === 'Identifier' && handlerMap.has(handlerArg.name)) {
              handlerName = handlerArg.name;
              const hInfo = handlerMap.get(handlerArg.name)!;
              handlerLine = hInfo.line;
              servicesCalled = hInfo.servicesCalled;
              responseShape = hInfo.responseShape;
            } else {
              // Direct inline handler
              servicesCalled = this.findServiceCallsInNode(nodePath);
              responseShape = this.inferResponseShape(nodePath);
            }

            const snippet = nodePath.node.loc ? lines.slice(nodePath.node.loc.start.line - 1, nodePath.node.loc.end.line).join('\n') : '';

            routes.push({
              method,
              path: routePath,
              fullPath,
              file: filePath,
              line: handlerLine,
              endLine: nodePath.node.loc?.end.line,
              handlerName,
              servicesCalled,
              responseShape: responseShape || { id: 'string', status: 'string' },
              codeSnippet: snippet
            });
          }
        }
      }
    });

    return routes;
  }

  private scanServiceFile(filePath: string): BackendServiceInfo[] {
    const code = fs.readFileSync(filePath, 'utf-8');
    const lines = code.split('\n');
    const services: BackendServiceInfo[] = [];

    let ast: parser.ParseResult<parser.File>;
    try {
      ast = parser.parse(code, {
        sourceType: 'module',
        plugins: ['typescript']
      });
    } catch (e) {
      return services;
    }

    // Extract TypeScript Interfaces / Types for response shape
    const typeShapes = new Map<string, Record<string, string>>();
    traverse(ast, {
      TSInterfaceDeclaration: (nodePath: any) => {
        const name = nodePath.node.id.name;
        const shape: Record<string, string> = {};
        for (const member of nodePath.node.body.body) {
          if (member.type === 'TSPropertySignature' && member.key && member.key.name) {
            const fieldName = member.key.name;
            const typeAnnotation = member.typeAnnotation?.typeAnnotation?.type || 'unknown';
            shape[fieldName] = typeAnnotation.replace('TS', '').replace('Keyword', '').toLowerCase();
          }
        }
        typeShapes.set(name, shape);
      }
    });

    // Detect service object declarations: export const userService = { async findUserById() { ... } }
    traverse(ast, {
      VariableDeclarator: (nodePath: any) => {
        const varName = nodePath.node.id?.name;
        if (varName && varName.toLowerCase().includes('service') && nodePath.node.init?.type === 'ObjectExpression') {
          for (const prop of nodePath.node.init.properties) {
            if (prop.type === 'ObjectMethod' || (prop.type === 'ObjectProperty' && (prop.value.type === 'ArrowFunctionExpression' || prop.value.type === 'FunctionExpression'))) {
              const methodName = prop.key?.name || 'method';
              const methodLoc = prop.loc;
              const dbCalls: any[] = [];
              const otherServicesCalled: any[] = [];

              // Traverse method body for DB calls and other service calls
              traverse(prop, {
                noScope: true,
                CallExpression: (callPath: any) => {
                  const callee = callPath.node.callee;
                  if (callee.type === 'MemberExpression') {
                    const objName = this.getMemberExpressionString(callee);
                    const callLine = callPath.node.loc?.start.line || 1;

                    // Check DB call pattern
                    if (this.isDbCall(objName)) {
                      const parts = objName.split('.');
                      const operation = parts[parts.length - 1];
                      const collection = parts.length > 2 ? parts[1] : 'default';
                      dbCalls.push({
                        dbAccessName: objName,
                        patternType: 'orm_call',
                        line: callLine,
                        collectionOrTable: collection,
                        operation
                      });
                    }
                    // Check other service calls
                    else if (objName.toLowerCase().includes('service') && !objName.startsWith(varName)) {
                      const parts = objName.split('.');
                      otherServicesCalled.push({
                        serviceName: parts[0],
                        methodName: parts[1] || 'call',
                        line: callLine
                      });
                    }
                  }
                }
              });

              const snippet = methodLoc ? lines.slice(methodLoc.start.line - 1, methodLoc.end.line).join('\n') : '';

              // Find response shape
              let responseShape: Record<string, string> | undefined;
              for (const [typeName, shape] of typeShapes.entries()) {
                if (typeName.toLowerCase().includes(varName.replace('Service', '').toLowerCase())) {
                  responseShape = shape;
                  break;
                }
              }

              services.push({
                name: varName,
                methodName,
                file: filePath,
                line: methodLoc?.start.line || 1,
                endLine: methodLoc?.end.line,
                dbCalls,
                otherServicesCalled,
                responseShape: responseShape || { id: 'string' },
                codeSnippet: snippet
              });
            }
          }
        }
      }
    });

    return services;
  }

  private isDbCall(callString: string): boolean {
    if (callString.startsWith('db.') || callString.startsWith('database.') || callString.startsWith('prisma.') || callString.startsWith('mongoose.')) {
      return true;
    }
    for (const pattern of this.config.dbCallPatterns) {
      if (callString.endsWith(`.${pattern}`) || callString.includes(`.${pattern}(`)) {
        return true;
      }
    }
    return false;
  }

  private getMemberExpressionString(node: any): string {
    if (node.type === 'Identifier') return node.name;
    if (node.type === 'MemberExpression') {
      const obj = this.getMemberExpressionString(node.object);
      const prop = node.property.name || (node.property.value ? String(node.property.value) : '');
      return obj ? `${obj}.${prop}` : prop;
    }
    return '';
  }

  private findServiceCallsInNode(nodePath: any): any[] {
    const servicesCalled: any[] = [];
    nodePath.traverse({
      CallExpression: (callPath: any) => {
        const callee = callPath.node.callee;
        if (callee.type === 'MemberExpression') {
          const callStr = this.getMemberExpressionString(callee);
          if (callStr.toLowerCase().includes('service')) {
            const parts = callStr.split('.');
            servicesCalled.push({
              serviceName: parts[0],
              methodName: parts[1] || 'default',
              line: callPath.node.loc?.start.line || 1
            });
          }
        }
      }
    });
    return servicesCalled;
  }

  private inferResponseShape(nodePath: any): Record<string, string> | undefined {
    let shape: Record<string, string> | undefined;
    nodePath.traverse({
      CallExpression: (callPath: any) => {
        const callee = callPath.node.callee;
        // res.json({ id: '...', name: '...' })
        if (callee.type === 'MemberExpression' && callee.property?.name === 'json') {
          const arg = callPath.node.arguments[0];
          if (arg && arg.type === 'ObjectExpression') {
            shape = {};
            for (const prop of arg.properties) {
              if (prop.type === 'ObjectProperty' && prop.key?.name) {
                shape[prop.key.name] = 'string';
              }
            }
          }
        }
      }
    });
    return shape;
  }

  private getAllFiles(dir: string): string[] {
    let results: string[] = [];
    if (!fs.existsSync(dir)) return results;
    const list = fs.readdirSync(dir);
    for (const file of list) {
      if (file === 'node_modules' || file === 'dist' || file === '.git') continue;
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat && stat.isDirectory()) {
        results = results.concat(this.getAllFiles(fullPath));
      } else {
        results.push(fullPath);
      }
    }
    return results;
  }
}
