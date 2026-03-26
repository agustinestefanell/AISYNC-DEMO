import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from 'react';
import { AgentPanel } from '../components/AgentPanel';
import { DividerRail } from '../components/DividerRail';
import { DocumentationMirrorTree, DocumentationTree } from '../components/DocumentationTree';
import { FileViewer } from '../components/FileViewer';
import { Modal } from '../components/Modal';
import { Toast } from '../components/Toast';
import { useApp } from '../context';
import { buildDocumentationModeModel } from '../documentationModel';
import { getInitialTeamsMapState, TEAMS_STORAGE_KEY, type TeamsMapState } from '../data/teams';
import {
  getDocumentationViewDescription,
  getDocumentationViewLabel,
  getSecondarySubManagerLabel,
} from '../pageLabels';
import type {
  DocumentationAuditEntry,
  DocumentationDocumentState,
  DocumentationKnowledgeEdge,
  DocumentationKnowledgeNode,
  DocumentationRepositoryItem,
  DocumentationViewMode,
} from '../types';

const DOCUMENTATION_MODE_MANIFEST = [
  '# Manifiesto de Documentation Mode — AISync',
  '## Version 2',
  '',
  '## 1. Proposito',
  '',
  'Documentation Mode no es un simple explorador de carpetas.',
  'Es la capa documental estructural de AISync.',
  '',
  'Su funcion es transformar la actividad operativa de Teams, Sub-Managers y Workers en una estructura documental local, jerarquica, trazable y navegable, donde el usuario pueda comprender:',
  '',
  '- quien produjo cada documento,',
  '- desde que nivel jerarquico,',
  '- bajo que rol,',
  '- en que contexto operativo,',
  '- en que fase del trabajo,',
  '- y con que relacion respecto del resto del sistema.',
  '',
  'Documentation Mode debe actuar como memoria documental del proceso, no como almacenamiento indiferenciado.',
  '',
  '## 2. Principio rector',
  '',
  'La estructura documental debe reflejar la estructura real de Teams.',
  '',
  'Esto significa que el arbol de carpetas se organiza por:',
  '',
  '- jerarquia operativa,',
  '- proveniencia,',
  '- rol del agente,',
  '- continuidad del proceso,',
  '- y trazabilidad historica.',
  '',
  'La logica es coherente con el principio archivistico de proveniencia y con la preservacion del orden original, es decir, conservar el contexto de produccion y las relaciones reales entre documentos.',
  '',
  '## 3. Raiz del repositorio',
  '',
  'El usuario define manualmente la ubicacion raiz del repositorio documental.',
  '',
  'Ejemplo conceptual:',
  '',
  '/AISync_Repository/',
  '',
  'Esa raiz sera el punto de anclaje local a partir del cual Documentation Mode construira la estructura completa.',
  '',
  'AISync propone la estructura.',
  'El usuario define la ubicacion.',
  '',
  '## 4. Regla estructural general',
  '',
  'Debajo de la raiz, Documentation Mode debe reproducir fielmente la estructura de Teams.',
  '',
  'Cada Team tendra su propia carpeta.',
  'Dentro de cada Team existiran carpetas separadas por agente.',
  '',
  'La estructura debe reflejar:',
  '',
  '- General Manager,',
  '- Sub-Managers,',
  '- Workers,',
  '- sub-teams derivados por elasticidad organizacional,',
  '- y vinculos jerarquicos reales.',
  '',
  'No debe existir una organizacion plana que mezcle agentes de ramas distintas.',
  '',
  '## 5. Principio de proveniencia documental',
  '',
  'Cada agente debe tener su propia unidad documental.',
  '',
  'Eso implica:',
  '',
  '- una carpeta por Team,',
  '- una carpeta por Sub-Manager,',
  '- una carpeta por Worker,',
  '- y separacion documental por origen real.',
  '',
  'La carpeta no representa solo ubicacion fisica.',
  'Representa quien produjo que y desde donde.',
  '',
  '## 6. Principio de no reescritura historica',
  '',
  'Documentation Mode no debe reescribir retrospectivamente la historia operativa.',
  '',
  '### Regla obligatoria:',
  'Si un Worker es promovido a Sub-Manager:',
  '',
  '- no se renombra la carpeta historica del Worker',
  '- no se reutiliza esa carpeta como si siempre hubiese sido Sub-Manager',
  '- no se borra su etapa anterior',
  '',
  'En su lugar:',
  '',
  '- la carpeta historica del Worker se conserva,',
  '- y se crea una nueva carpeta para el nuevo rol de Sub-Manager.',
  '',
  'Motivo:',
  'el Worker cumplio funciones bajo un rol especifico; el nuevo Sub-Manager cumple funciones distintas y constituye una unidad operativa distinta.',
  '',
  'Renombrar la carpeta anterior destruiria trazabilidad.',
  '',
  '## 7. Regla de promocion de agentes',
  '',
  'Cuando ocurre elasticidad organizacional y un Worker es promovido:',
  '',
  '### Debe pasar esto:',
  '- la carpeta historica del Worker permanece intacta;',
  '- se crea una nueva carpeta para el nuevo Sub-Manager;',
  '- esa nueva carpeta pasa a ser cabeza de una nueva subestructura documental;',
  '- los nuevos Workers cuelgan de esa nueva unidad.',
  '',
  '### No debe pasar esto:',
  '- no se renombra la carpeta vieja;',
  '- no se fusionan roles distintos en una sola carpeta;',
  '- no se simula retrospectivamente que siempre tuvo el rol nuevo;',
  '- no se pierde continuidad historica.',
  '',
  '## 8. Identidad documental',
  '',
  'Cada unidad documental debe distinguir entre:',
  '',
  '- identidad estable',
  '- nombre visible',
  '- rol operativo',
  '- posicion jerarquica',
  '- estado temporal',
  '',
  'El nombre visible puede cambiar.',
  'La identidad documental no debe depender exclusivamente de ese nombre.',
  '',
  'Por eso, Documentation Mode debe usar una logica dual:',
  '',
  '- ID persistente',
  '- label visible editable',
  '',
  '## 9. Regla sobre renombres',
  '',
  'El renombre visible de un Team o un agente no debe destruir la trazabilidad historica.',
  '',
  'Por eso:',
  '',
  '- el sistema debe preservar continuidad aunque cambie el label,',
  '- y la estructura fisica no debe depender unicamente del nombre visible actual.',
  '',
  'La ruta fisica debe ser suficientemente estable como para no romper referencias, historial, indices o auditoria cuando cambian los nombres.',
  '',
  '## 10. Estructura minima por agente',
  '',
  'Dentro de la carpeta de cada agente, la documentacion debe organizarse por funcion operativa.',
  '',
  'La estructura minima recomendada es:',
  '',
  '- inbox / input',
  '- working',
  '- review & forward',
  '- output',
  '- archive',
  '',
  'El principio es claro:',
  '',
  'la carpeta del agente no es un cajon generico;',
  'debe reflejar el flujo real de trabajo del agente.',
  '',
  '## 11. La estructura fisica no alcanza',
  '',
  'Documentation Mode no debe depender solo del arbol de carpetas.',
  '',
  'La estructura fisica sirve para:',
  '',
  '- proveniencia,',
  '- jerarquia,',
  '- legibilidad,',
  '- y orden operativo.',
  '',
  'Pero la recuperacion rapida, el enlace con auditoria y la compatibilidad futura con compliance requieren ademas:',
  '',
  '- manifiestos',
  '- indice transversal',
  '- metadatos estructurados',
  '',
  'La carpeta da contexto.',
  'El indice y los metadatos dan velocidad, trazabilidad y recuperabilidad operativa.',
  '',
  '## 12. Manifiestos',
  '',
  'Cada Team y cada agente deben poder tener un manifiesto propio.',
  '',
  'Su funcion es registrar, como minimo:',
  '',
  '- team_id',
  '- team_label',
  '- agent_id',
  '- agent_label',
  '- agent_role',
  '- parent_team_id',
  '- parent_agent_id',
  '- created_at',
  '- updated_at',
  '- origin_workspace',
  '- status',
  '- record_class',
  '- sensitivity_level',
  '- retention_rule',
  '- official_copy',
  '- path',
  '- checksum',
  '- related_audit_events',
  '',
  'La carpeta es la estructura visible.',
  'El manifiesto es la estructura intelectual.',
  '',
  '## 13. Indice transversal',
  '',
  'Ademas del arbol y de los manifiestos individuales, Documentation Mode debe prever un indice transversal.',
  '',
  'Ese indice permitira busquedas rapidas por:',
  '',
  '- Team,',
  '- agente,',
  '- Sub-Manager,',
  '- Worker,',
  '- fecha,',
  '- evento,',
  '- tipo documental,',
  '- estado,',
  '- Review & Forward,',
  '- origen,',
  '- destino,',
  '- y relacion con Audit Log.',
  '',
  'Este indice es la pieza que hace posible que Documentation Mode sea compatible con:',
  '',
  '- Audit Log',
  '- Calendar Mode',
  '- busquedas rapidas',
  '- filtros por eventos o responsables',
  '',
  'Sin indice, el arbol es legible.',
  'Con indice, el sistema es operativamente explotable.',
  '',
  '## 14. Compatibilidad con Audit Log',
  '',
  'Documentation Mode debe ser compatible con Audit Log desde su diseno base.',
  '',
  'Eso significa que la documentacion debe poder vincularse con:',
  '',
  '- eventos de creacion,',
  '- eventos de edicion,',
  '- Review & Forward,',
  '- versiones,',
  '- outputs aprobados,',
  '- responsables,',
  '- y fechas relevantes.',
  '',
  'Audit Log debe poder consultar Documentation Mode no solo por ruta fisica, sino tambien por:',
  '',
  '- metadatos,',
  '- manifests,',
  '- indice transversal,',
  '- y vinculo entre evento y documento.',
  '',
  '## 15. Compatibilidad con Calendar Mode',
  '',
  'Documentation Mode debe prever compatibilidad futura con Calendar Mode.',
  '',
  'Eso requiere que los documentos y eventos puedan asociarse temporalmente a:',
  '',
  '- fecha de creacion,',
  '- fecha de revision,',
  '- fecha de forward,',
  '- fecha de aprobacion,',
  '- fecha de archivo,',
  '- hitos relevantes del proceso.',
  '',
  'De esta manera, Calendar Mode podra consultar y mostrar actividad documental por linea de tiempo, sin depender del nombre de archivo o de inspeccion manual del arbol.',
  '',
  '## 16. Separacion entre trabajo y archivo',
  '',
  'Documentation Mode debe distinguir claramente entre:',
  '',
  '- documentacion activa,',
  '- documentacion en revision,',
  '- documentacion final,',
  '- documentacion archivada.',
  '',
  'No todo debe convivir en el mismo nivel.',
  '',
  'Un sistema serio necesita distinguir entre:',
  '- lo que se esta produciendo,',
  '- lo que esta siendo revisado,',
  '- lo que fue enviado,',
  '- lo que fue aprobado,',
  '- y lo que queda como evidencia historica.',
  '',
  '## 17. Compatibilidad con data compliance',
  '',
  'Documentation Mode debe nacer preparado para compatibilidad futura con compliance documental y regulatorio.',
  '',
  'Eso implica prever desde ahora:',
  '',
  '- clasificacion documental,',
  '- regla de retencion,',
  '- copia oficial / record copy,',
  '- estados del documento,',
  '- legal hold,',
  '- politica de archivo,',
  '- y trazabilidad de cambios.',
  '',
  'Esto no significa que toda esa logica deba implementarse ya.',
  'Significa que la estructura debe dejar espacio para integrarla sin redisenar todo desde cero.',
  '',
  '## 18. Compatibilidad con data safety',
  '',
  'Documentation Mode tambien debe nacer preparado para compatibilidad futura con data safety.',
  '',
  'Eso exige dejar previstas capas para:',
  '',
  '- control de acceso por rol,',
  '- sensibilidad documental,',
  '- integridad del archivo,',
  '- checksum / fixity,',
  '- cifrado si corresponde,',
  '- y proteccion frente a alteracion o perdida.',
  '',
  '## 19. Regla de no mezcla entre copy oficial y working copy',
  '',
  'Documentation Mode debe distinguir entre:',
  '',
  '- working copy,',
  '- reviewed copy,',
  '- official copy,',
  '- archived record.',
  '',
  'Esto es importante para:',
  '- trazabilidad,',
  '- cumplimiento,',
  '- auditoria,',
  '- y seguridad juridica del sistema.',
  '',
  'Un archivo no debe quedar ambiguamente entre borrador, version aprobada y registro historico.',
  '',
  '## 20. Regla de legibilidad humana',
  '',
  'Aunque la estructura sea rigurosa, debe seguir siendo comprensible para el usuario.',
  '',
  'Eso exige:',
  '',
  '- nombres legibles,',
  '- jerarquias claras,',
  '- consistencia visual,',
  '- relacion evidente con Teams Map.',
  '',
  'El usuario debe poder mirar Documentation Mode y entender que esta viendo la traduccion documental del sistema operativo de AISync.',
  '',
  '## 21. Regla de coherencia con Teams Map',
  '',
  'Documentation Mode debe ser el espejo documental de Teams Map.',
  '',
  'Si Teams Map muestra:',
  '',
  '- un Team,',
  '- un Sub-Manager,',
  '- dos Workers,',
  '- y una rama promovida,',
  '',
  'Documentation Mode debe reflejar exactamente esa logica en carpetas y manifiestos.',
  '',
  'No deben existir dos realidades paralelas:',
  '- una operativa,',
  '- otra documental.',
  '',
  '## 22. Regla de estabilidad',
  '',
  'La estructura documental no debe cambiar caprichosamente frente a cambios menores de UI.',
  '',
  'Debe priorizarse:',
  '',
  '- estabilidad,',
  '- persistencia,',
  '- continuidad,',
  '- trazabilidad historica.',
  '',
  'Documentation Mode no es un efecto visual; es una capa estructural del sistema.',
  '',
  '## 23. Regla de expansion futura',
  '',
  'La estructura debe poder crecer para incorporar mas adelante:',
  '',
  '- manifests enlazados,',
  '- versiones,',
  '- hashes,',
  '- locks documentales,',
  '- estados de aprobacion,',
  '- legal hold,',
  '- busqueda por metadata,',
  '- vinculo fuerte con Audit Log,',
  '- y visualizacion cronologica en Calendar Mode.',
  '',
  'La base debe estar preparada desde el diseno, aunque esas funciones se implementen despues.',
  '',
  '## 24. Definicion final',
  '',
  'Documentation Mode en AISync sera un sistema documental local, jerarquico, trazable y compatible con gobernanza futura, construido a partir de la estructura real de Teams, donde:',
  '',
  '- cada Team tendra su unidad documental,',
  '- cada agente tendra su unidad documental propia,',
  '- los cambios de rol no reescribiran la historia,',
  '- el arbol fisico preservara proveniencia,',
  '- y los manifests + indices permitiran recuperacion rapida, auditoria, compliance y expansion futura hacia data safety.',
  '',
  '## 25. Regla operativa resumida',
  '',
  'En una linea:',
  '',
  'cada carpeta y cada manifiesto deben decir quien produjo que, desde donde, bajo que rol, en que momento, con que estado y con que relacion con el resto del sistema, sin destruir la historia cuando la estructura evoluciona.',
].join('\n');

function isRepositoryDocumentItem(item: DocumentationRepositoryItem) {
  return item.itemType === 'file';
}

function getRepositoryStatusLabel(item: DocumentationRepositoryItem) {
  return item.documentState ?? item.status;
}

function getDocumentStateClasses(state: DocumentationDocumentState) {
  if (state === 'Draft') return 'border-neutral-200 bg-neutral-100 text-neutral-700';
  if (state === 'In Progress') return 'border-sky-200 bg-sky-50 text-sky-700';
  if (state === 'Under Review') return 'border-amber-200 bg-amber-50 text-amber-700';
  if (state === 'Approved') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  return 'border-neutral-300 bg-neutral-900 text-white';
}

function getAuditEventClasses(kind: DocumentationAuditEntry['eventKind']) {
  if (kind === 'created') return 'border-neutral-200 bg-neutral-100 text-neutral-700';
  if (kind === 'updated') return 'border-sky-200 bg-sky-50 text-sky-700';
  if (kind === 'state-changed') return 'border-amber-200 bg-amber-50 text-amber-700';
  if (kind === 'version-advanced') return 'border-violet-200 bg-violet-50 text-violet-700';
  if (kind === 'locked') return 'border-neutral-300 bg-neutral-900 text-white';
  return 'border-emerald-200 bg-emerald-50 text-emerald-700';
}

const KNOWLEDGE_FOCUS_MODE_OPTIONS: Array<{ value: KnowledgeFocusMode; label: string }> = [
  { value: 'documents', label: 'Documents' },
  { value: 'users', label: 'Users' },
  { value: 'projects', label: 'Projects' },
  { value: 'teams', label: 'Teams' },
  { value: 'folders', label: 'Folders' },
  { value: 'saved-files', label: 'Saved Files' },
  { value: 'workspaces', label: 'Workspaces' },
  { value: 'document-types', label: 'Document Types' },
];

type InvestigationThread = {
  repositoryItemId: string;
  title: string;
  projectLabel: string | null;
  teamId: string;
  teamLabel: string;
  sourceWorkspace: string;
  documentKind: string | null;
  userLabel: string | null;
  lastResponsible: string | null;
  documentState: DocumentationDocumentState | null;
  documentVersion: string | null;
  relatedFileId?: string;
  chronology: DocumentationAuditEntry[];
  firstSeen: string | null;
  lastSeen: string | null;
};

type KnowledgeFocusMode =
  | 'documents'
  | 'users'
  | 'projects'
  | 'teams'
  | 'folders'
  | 'saved-files'
  | 'workspaces'
  | 'document-types';

type KnowledgeGraphNodeType =
  | DocumentationKnowledgeNode['nodeType']
  | 'user'
  | 'folder'
  | 'saved-file';

type KnowledgeGraphNode = Omit<DocumentationKnowledgeNode, 'nodeType'> & {
  nodeType: KnowledgeGraphNodeType;
};

function ProjectCard({
  projectId,
  projectName,
  onOpenFile,
  onToast,
}: {
  projectId: string;
  projectName: string;
  onOpenFile: (fileId: string) => void;
  onToast: (message: string) => void;
}) {
  const { state } = useApp();
  const files = state.savedFiles.filter((file) => file.projectId === projectId);

  const grouped = useMemo(
    () => ({
      conversations: files.filter((file) => file.type === 'Conversation'),
      documents: files.filter((file) => file.type === 'Document'),
      reports: files.filter((file) => file.type === 'Report'),
    }),
    [files],
  );

  return (
    <div className="min-h-0" data-docs-project-card={projectId}>
      <div className="mb-2 flex items-center gap-3">
        <h3 className="text-sm text-neutral-800">{projectName}</h3>
        <div className="h-px flex-1 bg-neutral-300" />
      </div>

      <div className="ui-surface h-full min-h-[320px] px-3 py-3">
        <DocumentationTree
          projectName={projectName}
          groupedFiles={grouped}
          onOpenFile={onOpenFile}
        />

        <div className="mt-4 flex flex-wrap gap-3 border-t border-neutral-200 pt-3 text-[11px]">
          <button
            className="text-neutral-700 underline-offset-2 transition-colors hover:text-neutral-950 hover:underline"
            onClick={() => onToast('Folder creation is a placeholder in this demo.')}
          >
            [+ New Folder]
          </button>
          <button
            className="text-neutral-700 underline-offset-2 transition-colors hover:text-neutral-950 hover:underline"
            onClick={() => onToast('Open in Finder/Explorer is not available in the web demo.')}
          >
            [Open in Finder/Explorer]
          </button>
        </div>
      </div>
    </div>
  );
}

export function PageB() {
  const { state, dispatch } = useApp();
  const subManagerLabel = getSecondarySubManagerLabel('B');
  const [showManagerMobile, setShowManagerMobile] = useState(false);
  const [showManifestView, setShowManifestView] = useState(false);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [openFileId, setOpenFileId] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [activeView, setActiveView] = useState<DocumentationViewMode>('repository');
  const [repositoryQuery, setRepositoryQuery] = useState('');
  const [repositoryProjectFilter, setRepositoryProjectFilter] = useState('all');
  const [repositoryTeamFilter, setRepositoryTeamFilter] = useState('all');
  const [repositoryTypeFilter, setRepositoryTypeFilter] = useState('all');
  const [repositoryStatusFilter, setRepositoryStatusFilter] = useState('all');
  const [repositoryDateFilter, setRepositoryDateFilter] = useState('');
  const [auditStateFilter, setAuditStateFilter] = useState('all');
  const [auditEventFilter, setAuditEventFilter] = useState('all');
  const [auditResponsibleFilter, setAuditResponsibleFilter] = useState('all');
  const [auditDateFilter, setAuditDateFilter] = useState('');
  const [investigateProjectFilter, setInvestigateProjectFilter] = useState('all');
  const [investigateTeamFilter, setInvestigateTeamFilter] = useState('all');
  const [investigateWorkspaceFilter, setInvestigateWorkspaceFilter] = useState('all');
  const [investigateKindFilter, setInvestigateKindFilter] = useState('all');
  const [investigateDateFilter, setInvestigateDateFilter] = useState('');
  const [knowledgeProjectFilter, setKnowledgeProjectFilter] = useState('');
  const [knowledgeTeamFilter, setKnowledgeTeamFilter] = useState('all');
  const [knowledgeWorkspaceFilter, setKnowledgeWorkspaceFilter] = useState('all');
  const [knowledgeTypeFilter, setKnowledgeTypeFilter] = useState('all');
  const [knowledgeFocusMode, setKnowledgeFocusMode] = useState<KnowledgeFocusMode>('documents');
  const [selectedKnowledgeNodeId, setSelectedKnowledgeNodeId] = useState<string | null>(null);
  const [selectedRepositoryItemId, setSelectedRepositoryItemId] = useState<string | null>(null);
  const [showRepositoryDetailModal, setShowRepositoryDetailModal] = useState(false);
  const [repositoryFocusMode, setRepositoryFocusMode] = useState<'list' | 'detail'>('list');
  const [teamsMapState, setTeamsMapState] = useState<TeamsMapState>(getInitialTeamsMapState);

  useEffect(() => {
    const syncTeamsMapState = () => {
      setTeamsMapState(getInitialTeamsMapState());
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key === TEAMS_STORAGE_KEY) {
        syncTeamsMapState();
      }
    };

    syncTeamsMapState();
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const openFile = state.savedFiles.find((file) => file.id === openFileId) ?? null;
  const openProject =
    state.projects.find((project) => project.id === openFile?.projectId) ?? null;
  const documentationModel = useMemo(
    () =>
      buildDocumentationModeModel({
        root: state.documentationRoot,
        teamsGraph: teamsMapState.teamsGraph,
        savedFiles: state.savedFiles,
        calendarEvents: state.calendarEvents,
        mainWorkspace: {
          projectName: state.projectName,
          userName: state.userName,
          messages: state.messages,
          workspaceVersions: state.workspaceVersions,
          documentLocks: state.documentLocks,
        },
      }),
    [
      state.calendarEvents,
      state.documentLocks,
      state.documentationRoot,
      state.messages,
      state.projectName,
      state.userName,
      state.savedFiles,
      state.workspaceVersions,
      teamsMapState.teamsGraph,
    ],
  );
  const activeViewDefinition =
    documentationModel.views.find((view) => view.mode === activeView) ?? documentationModel.views[0];
  const recentIndexEntries = useMemo(
    () =>
      [...documentationModel.indexEntries]
        .sort((left, right) => (right.date ?? '').localeCompare(left.date ?? ''))
        .slice(0, 8),
    [documentationModel.indexEntries],
  );
  const teamSummaries = useMemo(
    () =>
      documentationModel.teamFolders.map((folder) => {
        const units = documentationModel.agentUnits.filter((unit) => unit.teamId === folder.teamId);
        const manifests = documentationModel.agentManifests.filter((manifest) => manifest.team_id === folder.teamId);
        const events = documentationModel.indexEntries.filter((entry) => entry.teamId === folder.teamId);

        return {
          teamId: folder.teamId,
          teamLabel: folder.teamLabel,
          units: units.length,
          manifests: manifests.length,
          events: events.length,
        };
      }),
    [documentationModel.agentManifests, documentationModel.agentUnits, documentationModel.indexEntries, documentationModel.teamFolders],
  );
  const repositoryProjectOptions = useMemo(
    () =>
      Array.from(
        new Set(documentationModel.repositoryItems.map((item) => item.projectLabel).filter((value): value is string => Boolean(value))),
      ).sort((left, right) => left.localeCompare(right)),
    [documentationModel.repositoryItems],
  );
  const repositoryTeamOptions = useMemo(
    () =>
      Array.from(
        documentationModel.repositoryItems.reduce(
          (accumulator, item) => accumulator.set(item.teamId, item.teamLabel),
          new Map<string, string>(),
        ),
      )
        .map(([value, label]) => ({ value, label }))
        .sort((left, right) => left.label.localeCompare(right.label)),
    [documentationModel.repositoryItems],
  );
  const auditResponsibleOptions = useMemo(
    () =>
      Array.from(
        new Set(
          documentationModel.auditEntries
            .map((entry) => entry.responsibleLabel)
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort((left, right) => left.localeCompare(right)),
    [documentationModel.auditEntries],
  );
  const auditEventOptions = useMemo(
    () =>
      Array.from(
        documentationModel.auditEntries.reduce(
          (accumulator, entry) => accumulator.set(entry.eventKind, entry.eventLabel),
          new Map<string, string>(),
        ),
      )
        .map(([value, label]) => ({ value, label }))
        .sort((left, right) => left.label.localeCompare(right.label)),
    [documentationModel.auditEntries],
  );
  const investigateProjectOptions = useMemo(
    () =>
      Array.from(
        new Set(
          documentationModel.repositoryItems
            .filter((item) => isRepositoryDocumentItem(item))
            .map((item) => item.projectLabel)
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort((left, right) => left.localeCompare(right)),
    [documentationModel.repositoryItems],
  );
  const investigateTeamOptions = useMemo(
    () =>
      Array.from(
        documentationModel.repositoryItems
          .filter((item) => isRepositoryDocumentItem(item))
          .reduce((accumulator, item) => accumulator.set(item.teamId, item.teamLabel), new Map<string, string>()),
      )
        .map(([value, label]) => ({ value, label }))
        .sort((left, right) => left.label.localeCompare(right.label)),
    [documentationModel.repositoryItems],
  );
  const investigateWorkspaceOptions = useMemo(
    () =>
      Array.from(
        new Set(
          documentationModel.repositoryItems
            .filter((item) => isRepositoryDocumentItem(item))
            .map((item) => item.sourceWorkspace),
        ),
      ).sort((left, right) => left.localeCompare(right)),
    [documentationModel.repositoryItems],
  );
  const investigateKindOptions = useMemo(
    () =>
      Array.from(
        new Set(
          documentationModel.repositoryItems
            .filter((item) => isRepositoryDocumentItem(item))
            .map((item) => item.documentKind)
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort((left, right) => left.localeCompare(right)),
    [documentationModel.repositoryItems],
  );
  const repositoryFilteredItems = useMemo(() => {
    const query = repositoryQuery.trim().toLowerCase();

    return documentationModel.repositoryItems
      .filter((item) => {
        const matchesQuery =
          query.length === 0 ||
          [
            item.title,
            item.teamLabel,
            item.ownerLabel ?? '',
            item.itemType,
            item.recordClass,
            item.projectLabel ?? '',
            item.documentState ?? '',
            item.documentVersion ?? '',
            item.lastResponsible ?? '',
          ]
            .join(' ')
            .toLowerCase()
            .includes(query);
        const matchesProject =
          repositoryProjectFilter === 'all' || item.projectLabel === repositoryProjectFilter;
        const matchesTeam = repositoryTeamFilter === 'all' || item.teamId === repositoryTeamFilter;
        const matchesType = repositoryTypeFilter === 'all' || item.itemType === repositoryTypeFilter;
        const statusValue = getRepositoryStatusLabel(item);
        const matchesStatus =
          repositoryStatusFilter === 'all' || statusValue === repositoryStatusFilter;
        const matchesDate =
          !repositoryDateFilter || (item.updatedAt ?? '').slice(0, 10) === repositoryDateFilter;

        return (
          matchesQuery &&
          matchesProject &&
          matchesTeam &&
          matchesType &&
          matchesStatus &&
          matchesDate
        );
      })
      .sort((left, right) => {
        const leftMain = left.teamId === 'main-workspace' ? 0 : 1;
        const rightMain = right.teamId === 'main-workspace' ? 0 : 1;
        if (leftMain !== rightMain) {
          return leftMain - rightMain;
        }

        return (right.updatedAt ?? '').localeCompare(left.updatedAt ?? '') || left.title.localeCompare(right.title);
      });
  }, [
    documentationModel.repositoryItems,
    repositoryDateFilter,
    repositoryProjectFilter,
    repositoryQuery,
    repositoryStatusFilter,
    repositoryTeamFilter,
    repositoryTypeFilter,
  ]);
  const selectedRepositoryItem =
    repositoryFilteredItems.find((item) => item.id === selectedRepositoryItemId) ??
    documentationModel.repositoryItems.find((item) => item.id === selectedRepositoryItemId) ??
    repositoryFilteredItems[0] ??
    null;
  const selectedRepositoryDocumentProject =
    selectedRepositoryItem && isRepositoryDocumentItem(selectedRepositoryItem)
      ? selectedRepositoryItem.projectLabel ?? null
      : null;
  const auditFilteredEntries = useMemo(
    () =>
      documentationModel.auditEntries
        .filter((entry) => {
          const matchesState =
            auditStateFilter === 'all' || entry.documentState === auditStateFilter;
          const matchesEvent =
            auditEventFilter === 'all' || entry.eventKind === auditEventFilter;
          const matchesResponsible =
            auditResponsibleFilter === 'all' || entry.responsibleLabel === auditResponsibleFilter;
          const matchesDate =
            !auditDateFilter || (entry.occurredAt ?? '').slice(0, 10) === auditDateFilter;

          return matchesState && matchesEvent && matchesResponsible && matchesDate;
        })
        .sort((left, right) => (right.occurredAt ?? '').localeCompare(left.occurredAt ?? '')),
    [
      auditDateFilter,
      auditEventFilter,
      auditResponsibleFilter,
      auditStateFilter,
      documentationModel.auditEntries,
    ],
  );
  const investigateThreads = useMemo<InvestigationThread[]>(
    () =>
      documentationModel.repositoryItems
        .filter((item) => isRepositoryDocumentItem(item))
        .map((item) => {
          const chronology = documentationModel.auditEntries
            .filter((entry) => entry.repositoryItemId === item.id)
            .sort((left, right) => (left.occurredAt ?? '').localeCompare(right.occurredAt ?? ''));
          const firstSeen = chronology[0]?.occurredAt ?? item.updatedAt;
          const lastSeen = chronology[chronology.length - 1]?.occurredAt ?? item.updatedAt;
          return {
            repositoryItemId: item.id,
            title: item.title,
            projectLabel: item.projectLabel,
            teamId: item.teamId,
            teamLabel: item.teamLabel,
            sourceWorkspace: item.sourceWorkspace,
            documentKind: item.documentKind,
            userLabel: item.userLabel,
            lastResponsible: item.lastResponsible,
            documentState: item.documentState,
            documentVersion: item.documentVersion,
            relatedFileId: item.relatedFileId,
            chronology,
            firstSeen,
            lastSeen,
          };
        })
        .filter((thread) => {
          const matchesProject =
            investigateProjectFilter === 'all' || thread.projectLabel === investigateProjectFilter;
          const matchesTeam =
            investigateTeamFilter === 'all' || thread.teamId === investigateTeamFilter;
          const matchesWorkspace =
            investigateWorkspaceFilter === 'all' || thread.sourceWorkspace === investigateWorkspaceFilter;
          const matchesKind =
            investigateKindFilter === 'all' || thread.documentKind === investigateKindFilter;
          const matchesDate =
            !investigateDateFilter || (thread.lastSeen ?? '').slice(0, 10) === investigateDateFilter;

          return matchesProject && matchesTeam && matchesWorkspace && matchesKind && matchesDate;
        })
        .sort((left, right) => (right.lastSeen ?? '').localeCompare(left.lastSeen ?? '')),
    [
      documentationModel.auditEntries,
      documentationModel.repositoryItems,
      investigateDateFilter,
      investigateKindFilter,
      investigateProjectFilter,
      investigateTeamFilter,
      investigateWorkspaceFilter,
    ],
  );
  const investigateTimelineGroups = useMemo(
    () =>
      investigateThreads.reduce<Array<{ date: string; threads: InvestigationThread[] }>>((accumulator, thread) => {
        const date = (thread.lastSeen ?? thread.firstSeen ?? 'n/a').slice(0, 10) || 'n/a';
        const existing = accumulator.find((group) => group.date === date);
        if (existing) {
          existing.threads.push(thread);
          return accumulator;
        }
        return [...accumulator, { date, threads: [thread] }];
      }, []),
    [investigateThreads],
  );
  const knowledgeProjectOptions = useMemo(
    () =>
      Array.from(
        new Set(
          documentationModel.knowledgeMap.nodes
            .filter((node) => node.nodeType === 'project')
            .map((node) => node.label),
        ),
      ).sort((left, right) => left.localeCompare(right)),
    [documentationModel.knowledgeMap.nodes],
  );
  const knowledgeTeamOptions = useMemo(
    () =>
      documentationModel.knowledgeMap.nodes
        .filter((node) => node.nodeType === 'team' && node.teamId)
        .map((node) => ({ value: node.teamId as string, label: node.label }))
        .sort((left, right) => left.label.localeCompare(right.label)),
    [documentationModel.knowledgeMap.nodes],
  );
  const knowledgeWorkspaceOptions = useMemo(
    () =>
      Array.from(
        new Set(
          documentationModel.knowledgeMap.nodes
            .filter((node) => node.nodeType === 'workspace')
            .map((node) => node.label),
        ),
      ).sort((left, right) => left.localeCompare(right)),
    [documentationModel.knowledgeMap.nodes],
  );
  const knowledgeTypeOptions = useMemo(
    () =>
      Array.from(
        new Set(
          documentationModel.knowledgeMap.nodes
            .filter((node) => node.nodeType === 'document-type')
            .map((node) => node.label),
        ),
      ).sort((left, right) => left.localeCompare(right)),
    [documentationModel.knowledgeMap.nodes],
  );
  const knowledgeFilteredDocumentNodes = useMemo(() => {
    const effectiveProjectFilter =
      knowledgeProjectFilter || selectedRepositoryDocumentProject || knowledgeProjectOptions[0] || 'all';

    return documentationModel.knowledgeMap.nodes
      .filter((node) => node.nodeType === 'document')
      .filter((node) => {
        const matchesProject =
          effectiveProjectFilter === 'all' || node.projectLabel === effectiveProjectFilter;
        const matchesTeam = knowledgeTeamFilter === 'all' || node.teamId === knowledgeTeamFilter;
        const matchesWorkspace =
          knowledgeWorkspaceFilter === 'all' || node.workspaceLabel === knowledgeWorkspaceFilter;
        const matchesType = knowledgeTypeFilter === 'all' || node.documentKind === knowledgeTypeFilter;
        return matchesProject && matchesTeam && matchesWorkspace && matchesType;
      })
      .sort(
        (left, right) =>
          (right.updatedAt ?? '').localeCompare(left.updatedAt ?? '') || left.label.localeCompare(right.label),
      )
      .slice(0, 8);
  }, [
    documentationModel.knowledgeMap.nodes,
    knowledgeProjectFilter,
    knowledgeProjectOptions,
    knowledgeTeamFilter,
    knowledgeTypeFilter,
    knowledgeWorkspaceFilter,
    selectedRepositoryDocumentProject,
  ]);
  const knowledgeGraph = useMemo(() => {
    const nodes = new Map<string, KnowledgeGraphNode>();
    const edges = new Map<string, DocumentationKnowledgeEdge>();

    const addNode = (node: KnowledgeGraphNode) => {
      if (!nodes.has(node.id)) {
        nodes.set(node.id, node);
      }
    };

    const addEdge = (edge: DocumentationKnowledgeEdge) => {
      if (!edges.has(edge.id)) {
        edges.set(edge.id, edge);
      }
    };

    const registerDocumentContext = (documentNode: DocumentationKnowledgeNode) => {
      addNode({ ...documentNode });
      if (documentNode.projectLabel) {
        const projectId = `focus:project:${documentNode.projectLabel}`;
        addNode({
          id: projectId,
          nodeType: 'project',
          label: documentNode.projectLabel,
          description: 'Project context',
          repositoryItemId: null,
          projectLabel: documentNode.projectLabel,
          teamId: null,
          teamLabel: null,
          workspaceLabel: null,
          documentKind: null,
          documentState: null,
          documentVersion: null,
          userLabel: null,
          lastResponsible: null,
          updatedAt: null,
          auditLinked: false,
        });
        addEdge({
          id: `${documentNode.id}->${projectId}:belongs-to`,
          sourceId: documentNode.id,
          targetId: projectId,
          edgeType: 'belongs-to',
          label: 'belongs to',
        });
      }
      if (documentNode.teamId && documentNode.teamLabel) {
        const teamId = `focus:team:${documentNode.teamId}`;
        addNode({
          id: teamId,
          nodeType: 'team',
          label: documentNode.teamLabel,
          description: 'Team context',
          repositoryItemId: null,
          projectLabel: documentNode.projectLabel,
          teamId: documentNode.teamId,
          teamLabel: documentNode.teamLabel,
          workspaceLabel: null,
          documentKind: null,
          documentState: null,
          documentVersion: null,
          userLabel: null,
          lastResponsible: null,
          updatedAt: null,
          auditLinked: false,
        });
        addEdge({
          id: `${documentNode.id}->${teamId}:linked-to-team`,
          sourceId: documentNode.id,
          targetId: teamId,
          edgeType: 'linked-to-team',
          label: 'linked to team',
        });
      }
      if (documentNode.workspaceLabel) {
        const workspaceId = `focus:workspace:${documentNode.workspaceLabel}`;
        addNode({
          id: workspaceId,
          nodeType: 'workspace',
          label: documentNode.workspaceLabel,
          description: 'Workspace context',
          repositoryItemId: null,
          projectLabel: null,
          teamId: null,
          teamLabel: null,
          workspaceLabel: documentNode.workspaceLabel,
          documentKind: null,
          documentState: null,
          documentVersion: null,
          userLabel: null,
          lastResponsible: null,
          updatedAt: null,
          auditLinked: false,
        });
        addEdge({
          id: `${documentNode.id}->${workspaceId}:created-in`,
          sourceId: documentNode.id,
          targetId: workspaceId,
          edgeType: 'created-in',
          label: 'created in',
        });
      }
      if (documentNode.documentKind) {
        const typeId = `focus:document-type:${documentNode.documentKind}`;
        addNode({
          id: typeId,
          nodeType: 'document-type',
          label: documentNode.documentKind,
          description: 'Document type',
          repositoryItemId: null,
          projectLabel: null,
          teamId: null,
          teamLabel: null,
          workspaceLabel: null,
          documentKind: documentNode.documentKind,
          documentState: null,
          documentVersion: null,
          userLabel: null,
          lastResponsible: null,
          updatedAt: null,
          auditLinked: false,
        });
        addEdge({
          id: `${documentNode.id}->${typeId}:typed-as`,
          sourceId: documentNode.id,
          targetId: typeId,
          edgeType: 'typed-as',
          label: 'typed as',
        });
      }
    };

    knowledgeFilteredDocumentNodes.forEach((documentNode) => {
      if (knowledgeFocusMode === 'documents') {
        registerDocumentContext(documentNode);
        return;
      }

      if (knowledgeFocusMode === 'users') {
        addNode({ ...documentNode });
        const userId = `focus:user:${documentNode.userLabel ?? 'unknown'}`;
        addNode({
          id: userId,
          nodeType: 'user',
          label: documentNode.userLabel ?? 'Unknown User',
          description: 'Accountability lens',
          repositoryItemId: null,
          projectLabel: documentNode.projectLabel,
          teamId: documentNode.teamId,
          teamLabel: documentNode.teamLabel,
          workspaceLabel: documentNode.workspaceLabel,
          documentKind: null,
          documentState: null,
          documentVersion: null,
          userLabel: documentNode.userLabel,
          lastResponsible: documentNode.lastResponsible,
          updatedAt: null,
          auditLinked: documentNode.auditLinked,
        });
        addEdge({
          id: `${userId}->${documentNode.id}:belongs-to`,
          sourceId: userId,
          targetId: documentNode.id,
          edgeType: 'belongs-to',
          label: 'accountable for',
        });
        if (documentNode.teamId && documentNode.teamLabel) {
          const teamId = `focus:team:${documentNode.teamId}`;
          addNode({
            id: teamId,
            nodeType: 'team',
            label: documentNode.teamLabel,
            description: 'Team context',
            repositoryItemId: null,
            projectLabel: documentNode.projectLabel,
            teamId: documentNode.teamId,
            teamLabel: documentNode.teamLabel,
            workspaceLabel: null,
            documentKind: null,
            documentState: null,
            documentVersion: null,
            userLabel: null,
            lastResponsible: null,
            updatedAt: null,
            auditLinked: false,
          });
          addEdge({
            id: `${documentNode.id}->${teamId}:linked-to-team`,
            sourceId: documentNode.id,
            targetId: teamId,
            edgeType: 'linked-to-team',
            label: 'linked to team',
          });
        }
        return;
      }

      if (knowledgeFocusMode === 'projects') {
        addNode({ ...documentNode });
        if (documentNode.projectLabel) {
          const projectId = `focus:project:${documentNode.projectLabel}`;
          addNode({
            id: projectId,
            nodeType: 'project',
            label: documentNode.projectLabel,
            description: 'Project context',
            repositoryItemId: null,
            projectLabel: documentNode.projectLabel,
            teamId: null,
            teamLabel: null,
            workspaceLabel: null,
            documentKind: null,
            documentState: null,
            documentVersion: null,
            userLabel: null,
            lastResponsible: null,
            updatedAt: null,
            auditLinked: false,
          });
          addEdge({
            id: `${documentNode.id}->${projectId}:belongs-to`,
            sourceId: documentNode.id,
            targetId: projectId,
            edgeType: 'belongs-to',
            label: 'belongs to',
          });
        }
        if (documentNode.teamId && documentNode.teamLabel && documentNode.projectLabel) {
          const teamId = `focus:team:${documentNode.teamId}`;
          const projectId = `focus:project:${documentNode.projectLabel}`;
          addNode({
            id: teamId,
            nodeType: 'team',
            label: documentNode.teamLabel,
            description: 'Team context',
            repositoryItemId: null,
            projectLabel: documentNode.projectLabel,
            teamId: documentNode.teamId,
            teamLabel: documentNode.teamLabel,
            workspaceLabel: null,
            documentKind: null,
            documentState: null,
            documentVersion: null,
            userLabel: null,
            lastResponsible: null,
            updatedAt: null,
            auditLinked: false,
          });
          addEdge({
            id: `${teamId}->${projectId}:linked-to-team`,
            sourceId: teamId,
            targetId: projectId,
            edgeType: 'linked-to-team',
            label: 'supports project',
          });
        }
        return;
      }

      if (knowledgeFocusMode === 'teams') {
        addNode({ ...documentNode });
        if (documentNode.teamId && documentNode.teamLabel) {
          const teamId = `focus:team:${documentNode.teamId}`;
          addNode({
            id: teamId,
            nodeType: 'team',
            label: documentNode.teamLabel,
            description: 'Team context',
            repositoryItemId: null,
            projectLabel: documentNode.projectLabel,
            teamId: documentNode.teamId,
            teamLabel: documentNode.teamLabel,
            workspaceLabel: null,
            documentKind: null,
            documentState: null,
            documentVersion: null,
            userLabel: null,
            lastResponsible: null,
            updatedAt: null,
            auditLinked: false,
          });
          addEdge({
            id: `${documentNode.id}->${teamId}:linked-to-team`,
            sourceId: documentNode.id,
            targetId: teamId,
            edgeType: 'linked-to-team',
            label: 'linked to team',
          });
          if (documentNode.workspaceLabel) {
            const workspaceId = `focus:workspace:${documentNode.workspaceLabel}`;
            addNode({
              id: workspaceId,
              nodeType: 'workspace',
              label: documentNode.workspaceLabel,
              description: 'Workspace context',
              repositoryItemId: null,
              projectLabel: null,
              teamId: null,
              teamLabel: null,
              workspaceLabel: documentNode.workspaceLabel,
              documentKind: null,
              documentState: null,
              documentVersion: null,
              userLabel: null,
              lastResponsible: null,
              updatedAt: null,
              auditLinked: false,
            });
            addEdge({
              id: `${teamId}->${workspaceId}:linked-to-workspace`,
              sourceId: teamId,
              targetId: workspaceId,
              edgeType: 'linked-to-workspace',
              label: 'operates in',
            });
          }
        }
        return;
      }

      if (knowledgeFocusMode === 'folders') {
        const folderLabel =
          documentNode.teamLabel && documentNode.teamLabel !== 'Main Workspace'
            ? `${documentNode.teamLabel} folder`
            : `${documentNode.workspaceLabel ?? 'Workspace'} folder`;
        const folderId = `focus:folder:${folderLabel}`;
        addNode({
          id: folderId,
          nodeType: 'folder',
          label: folderLabel,
          description: documentNode.description,
          repositoryItemId: null,
          projectLabel: documentNode.projectLabel,
          teamId: documentNode.teamId,
          teamLabel: documentNode.teamLabel,
          workspaceLabel: documentNode.workspaceLabel,
          documentKind: null,
          documentState: null,
          documentVersion: null,
          userLabel: null,
          lastResponsible: null,
          updatedAt: null,
          auditLinked: false,
        });
        addNode({ ...documentNode });
        addEdge({
          id: `${documentNode.id}->${folderId}:belongs-to`,
          sourceId: documentNode.id,
          targetId: folderId,
          edgeType: 'belongs-to',
          label: 'stored in',
        });
        return;
      }

      if (knowledgeFocusMode === 'saved-files') {
        const savedFileId = `focus:saved-file:${documentNode.id}`;
        addNode({
          ...documentNode,
          id: savedFileId,
          nodeType: 'saved-file',
          description: 'Persisted saved file',
        });
        if (documentNode.projectLabel) {
          const projectId = `focus:project:${documentNode.projectLabel}`;
          addNode({
            id: projectId,
            nodeType: 'project',
            label: documentNode.projectLabel,
            description: 'Project context',
            repositoryItemId: null,
            projectLabel: documentNode.projectLabel,
            teamId: null,
            teamLabel: null,
            workspaceLabel: null,
            documentKind: null,
            documentState: null,
            documentVersion: null,
            userLabel: null,
            lastResponsible: null,
            updatedAt: null,
            auditLinked: false,
          });
          addEdge({
            id: `${savedFileId}->${projectId}:belongs-to`,
            sourceId: savedFileId,
            targetId: projectId,
            edgeType: 'belongs-to',
            label: 'belongs to',
          });
        }
        if (documentNode.workspaceLabel) {
          const workspaceId = `focus:workspace:${documentNode.workspaceLabel}`;
          addNode({
            id: workspaceId,
            nodeType: 'workspace',
            label: documentNode.workspaceLabel,
            description: 'Workspace context',
            repositoryItemId: null,
            projectLabel: null,
            teamId: null,
            teamLabel: null,
            workspaceLabel: documentNode.workspaceLabel,
            documentKind: null,
            documentState: null,
            documentVersion: null,
            userLabel: null,
            lastResponsible: null,
            updatedAt: null,
            auditLinked: false,
          });
          addEdge({
            id: `${savedFileId}->${workspaceId}:linked-to-workspace`,
            sourceId: savedFileId,
            targetId: workspaceId,
            edgeType: 'linked-to-workspace',
            label: 'linked to workspace',
          });
        }
        return;
      }

      if (knowledgeFocusMode === 'workspaces') {
        addNode({ ...documentNode });
        if (documentNode.workspaceLabel) {
          const workspaceId = `focus:workspace:${documentNode.workspaceLabel}`;
          addNode({
            id: workspaceId,
            nodeType: 'workspace',
            label: documentNode.workspaceLabel,
            description: 'Workspace context',
            repositoryItemId: null,
            projectLabel: null,
            teamId: null,
            teamLabel: null,
            workspaceLabel: documentNode.workspaceLabel,
            documentKind: null,
            documentState: null,
            documentVersion: null,
            userLabel: null,
            lastResponsible: null,
            updatedAt: null,
            auditLinked: false,
          });
          addEdge({
            id: `${documentNode.id}->${workspaceId}:created-in`,
            sourceId: documentNode.id,
            targetId: workspaceId,
            edgeType: 'created-in',
            label: 'created in',
          });
        }
        return;
      }

      if (knowledgeFocusMode === 'document-types') {
        addNode({ ...documentNode });
        if (documentNode.documentKind) {
          const typeId = `focus:document-type:${documentNode.documentKind}`;
          addNode({
            id: typeId,
            nodeType: 'document-type',
            label: documentNode.documentKind,
            description: 'Document type',
            repositoryItemId: null,
            projectLabel: null,
            teamId: null,
            teamLabel: null,
            workspaceLabel: null,
            documentKind: documentNode.documentKind,
            documentState: null,
            documentVersion: null,
            userLabel: null,
            lastResponsible: null,
            updatedAt: null,
            auditLinked: false,
          });
          addEdge({
            id: `${documentNode.id}->${typeId}:typed-as`,
            sourceId: documentNode.id,
            targetId: typeId,
            edgeType: 'typed-as',
            label: 'typed as',
          });
          if (documentNode.projectLabel) {
            const projectId = `focus:project:${documentNode.projectLabel}`;
            addNode({
              id: projectId,
              nodeType: 'project',
              label: documentNode.projectLabel,
              description: 'Project context',
              repositoryItemId: null,
              projectLabel: documentNode.projectLabel,
              teamId: null,
              teamLabel: null,
              workspaceLabel: null,
              documentKind: null,
              documentState: null,
              documentVersion: null,
              userLabel: null,
              lastResponsible: null,
              updatedAt: null,
              auditLinked: false,
            });
            addEdge({
              id: `${projectId}->${typeId}:belongs-to`,
              sourceId: projectId,
              targetId: typeId,
              edgeType: 'belongs-to',
              label: 'contains type',
            });
          }
        }
      }
    });

    return {
      nodes: Array.from(nodes.values()),
      edges: Array.from(edges.values()),
    };
  }, [knowledgeFilteredDocumentNodes, knowledgeFocusMode]);
  const knowledgeConnectionsByNodeId = useMemo(() => {
    const connections = new Map<string, number>();
    knowledgeGraph.edges.forEach((edge) => {
      connections.set(edge.sourceId, (connections.get(edge.sourceId) ?? 0) + 1);
      connections.set(edge.targetId, (connections.get(edge.targetId) ?? 0) + 1);
    });
    return connections;
  }, [knowledgeGraph.edges]);
  const selectedKnowledgeNode =
    knowledgeGraph.nodes.find((node) => node.id === selectedKnowledgeNodeId) ??
    knowledgeGraph.nodes.find((node) => node.nodeType === 'document' || node.nodeType === 'saved-file') ??
    knowledgeGraph.nodes[0] ??
    null;
  const openFileRepositoryItem =
    (openFileId
      ? documentationModel.repositoryItems.find(
          (item) => item.itemType === 'file' && item.relatedFileId === openFileId,
        ) ?? null
      : null);
  const openFileInvestigationThread =
    (openFileId
      ? investigateThreads.find((thread) => thread.relatedFileId === openFileId) ?? null
      : null);

  useEffect(() => {
    if (!knowledgeProjectFilter) {
      setKnowledgeProjectFilter(selectedRepositoryDocumentProject ?? knowledgeProjectOptions[0] ?? 'all');
    }
  }, [knowledgeProjectFilter, knowledgeProjectOptions, selectedRepositoryDocumentProject]);

  useEffect(() => {
    if (knowledgeGraph.nodes.length === 0) {
      if (selectedKnowledgeNodeId !== null) {
        setSelectedKnowledgeNodeId(null);
      }
      return;
    }

    if (
      selectedKnowledgeNodeId &&
      knowledgeGraph.nodes.some((node) => node.id === selectedKnowledgeNodeId)
    ) {
      return;
    }

    const selectedDocumentNode =
      selectedRepositoryItem && isRepositoryDocumentItem(selectedRepositoryItem)
        ? knowledgeGraph.nodes.find((node) => node.repositoryItemId === selectedRepositoryItem.id) ?? null
        : null;

    setSelectedKnowledgeNodeId(
      selectedDocumentNode?.id ??
        knowledgeGraph.nodes.find((node) => node.nodeType === 'document' || node.nodeType === 'saved-file')?.id ??
        knowledgeGraph.nodes[0].id,
    );
  }, [knowledgeGraph.nodes, selectedKnowledgeNodeId, selectedRepositoryItem]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const itemIdFromLocation = params.get('doc_item');
    const viewFromLocation = params.get('doc_view');
    const shouldOpenFile = params.get('doc_open') === 'file';
    const shouldFocusDetail = params.get('doc_focus') === 'detail';

    if (viewFromLocation === 'repository' && activeView !== 'repository') {
      setActiveView('repository');
    }
    setRepositoryFocusMode(shouldFocusDetail ? 'detail' : 'list');

    if (itemIdFromLocation && documentationModel.repositoryItems.some((item) => item.id === itemIdFromLocation)) {
      setSelectedRepositoryItemId(itemIdFromLocation);
      const locationItem = documentationModel.repositoryItems.find((item) => item.id === itemIdFromLocation) ?? null;
      if (shouldOpenFile && locationItem?.relatedFileId) {
        setOpenFileId(locationItem.relatedFileId);
      }
      if (shouldFocusDetail && !shouldOpenFile) {
        setShowRepositoryDetailModal(true);
      }
      return;
    }

    if (!selectedRepositoryItemId && repositoryFilteredItems[0]) {
      setSelectedRepositoryItemId(repositoryFilteredItems[0].id);
    }
  }, [
    activeView,
    documentationModel.repositoryItems,
    repositoryFilteredItems,
    selectedRepositoryItemId,
  ]);

  useEffect(() => {
    if (!selectedRepositoryItemId) {
      if (repositoryFilteredItems[0]) {
        setSelectedRepositoryItemId(repositoryFilteredItems[0].id);
      }
      return;
    }

    if (
      repositoryFilteredItems.length > 0 &&
      !repositoryFilteredItems.some((item) => item.id === selectedRepositoryItemId)
    ) {
      setSelectedRepositoryItemId(repositoryFilteredItems[0].id);
    }
  }, [repositoryFilteredItems, selectedRepositoryItemId]);

  const handleCreateProject = () => {
    if (!newProjectName.trim()) {
      return;
    }

    dispatch({
      type: 'ADD_PROJECT',
      project: {
        id: `proj_${Date.now()}`,
        name: newProjectName.trim(),
      },
    });
    setNewProjectName('');
    setShowNewProjectModal(false);
    setToast('Project created.');
  };

  const focusRepositoryDocument = (
    repositoryItemId: string,
    options?: {
      openFile?: boolean;
    },
  ) => {
    const canonicalItem =
      documentationModel.repositoryItems.find(
        (candidate) => candidate.id === repositoryItemId && candidate.itemType === 'file',
      ) ?? null;
    if (!canonicalItem) {
      return;
    }

    setActiveView('repository');
    setRepositoryQuery('');
    setRepositoryProjectFilter('all');
    setRepositoryTeamFilter('all');
    setRepositoryTypeFilter('all');
    setRepositoryStatusFilter('all');
    setRepositoryDateFilter('');
    setSelectedRepositoryItemId(canonicalItem.id);
    setRepositoryFocusMode('list');
    setShowRepositoryDetailModal(false);

    if (
      options?.openFile &&
      canonicalItem.relatedFileId &&
      state.savedFiles.some((file) => file.id === canonicalItem.relatedFileId)
    ) {
      setOpenFileId(canonicalItem.relatedFileId);
      return;
    }

    if (!options?.openFile) {
      setOpenFileId(null);
    }
  };

  const buildRepositoryItemHref = (itemId: string) => {
    const item = documentationModel.repositoryItems.find((candidate) => candidate.id === itemId) ?? null;
    if (!item) return '#';

    const url = new URL(window.location.href);
    url.searchParams.set('page', 'B');
    url.searchParams.set('doc_view', 'repository');
    url.searchParams.set('doc_item', item.id);
    if (item.relatedFileId) {
      url.searchParams.set('doc_open', 'file');
      url.searchParams.delete('doc_focus');
    } else {
      url.searchParams.delete('doc_open');
      url.searchParams.set('doc_focus', 'detail');
    }

    return url.toString();
  };

  const documentationViewContent =
    activeView === 'structure' ? (
      <DocumentationMirrorTree model={documentationModel} />
    ) : activeView === 'repository' ? (
      <div className="grid gap-4 sm:gap-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <DocumentationStatCard
            label="Repository Root"
            value={documentationModel.root.path}
            meta="User-defined anchor for the shared documentary repository."
          />
          <DocumentationStatCard
            label="Teams"
            value={String(documentationModel.teamFolders.length)}
            meta="Documentary team folders mirrored from the current Teams structure."
          />
          <DocumentationStatCard
            label="Agent Units"
            value={String(documentationModel.agentUnits.length)}
            meta="Documentary units generated from sub-managers, workers, and preserved historical stages."
          />
          <DocumentationStatCard
            label="Indexed Records"
            value={String(documentationModel.indexEntries.length)}
            meta="Cross-view metadata ready for repository, audit, and investigation flows."
          />
        </div>

        <div className="ui-surface rounded-[22px] px-4 py-4 sm:px-5">
          <div className="mb-3 flex items-center gap-3">
            <h3 className="text-sm font-semibold tracking-[0.08em] text-neutral-900">Repository Workspace</h3>
            <div className="h-px flex-1 bg-neutral-200" />
          </div>
          <div className="grid gap-4">
            <div className="grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_repeat(4,minmax(0,0.8fr))]">
              <label className="grid gap-1">
                <span className="ui-label">Search repository</span>
                <input
                  className="ui-input text-xs"
                  value={repositoryQuery}
                  onChange={(event) => setRepositoryQuery(event.target.value)}
                  placeholder="Search by name, team, owner, type..."
                />
              </label>

              <label className="grid gap-1">
                <span className="ui-label">Project</span>
                <select
                  className="ui-input text-xs"
                  value={repositoryProjectFilter}
                  onChange={(event) => setRepositoryProjectFilter(event.target.value)}
                >
                  <option value="all">All projects</option>
                  {repositoryProjectOptions.map((project) => (
                    <option key={project} value={project}>
                      {project}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1">
                <span className="ui-label">Team</span>
                <select
                  className="ui-input text-xs"
                  value={repositoryTeamFilter}
                  onChange={(event) => setRepositoryTeamFilter(event.target.value)}
                >
                  <option value="all">All teams</option>
                  {repositoryTeamOptions.map((team) => (
                    <option key={team.value} value={team.value}>
                      {team.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1">
                <span className="ui-label">Type</span>
                <select
                  className="ui-input text-xs"
                  value={repositoryTypeFilter}
                  onChange={(event) => setRepositoryTypeFilter(event.target.value)}
                >
                  <option value="all">All types</option>
                  <option value="file">Files</option>
                  <option value="agent-unit">Agent units</option>
                  <option value="workspace-agent">Workspace agents</option>
                  <option value="team-folder">Team folders</option>
                </select>
              </label>

              <label className="grid gap-1">
                <span className="ui-label">State / Date</span>
                <div className="grid gap-2">
                  <select
                    className="ui-input text-xs"
                    value={repositoryStatusFilter}
                    onChange={(event) => setRepositoryStatusFilter(event.target.value)}
                  >
                    <option value="all">All states</option>
                    <option value="Draft">Draft</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Under Review">Under Review</option>
                    <option value="Approved">Approved</option>
                    <option value="Locked">Locked</option>
                  </select>
                  <input
                    className="ui-input text-xs"
                    type="date"
                    value={repositoryDateFilter}
                    onChange={(event) => setRepositoryDateFilter(event.target.value)}
                  />
                </div>
              </label>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 pt-3">
              <div className="text-xs text-neutral-600">
                {repositoryFilteredItems.length} repository items available from the shared documentary base.
              </div>
              <button
                className="ui-button min-h-8 px-3 text-[11px] text-neutral-700"
                onClick={() => {
                  setRepositoryQuery('');
                  setRepositoryProjectFilter('all');
                  setRepositoryTeamFilter('all');
                  setRepositoryTypeFilter('all');
                  setRepositoryStatusFilter('all');
                  setRepositoryDateFilter('');
                }}
              >
                Reset filters
              </button>
            </div>

            <div
              className={
                repositoryFocusMode === 'detail'
                  ? 'grid gap-4'
                  : 'grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)] xl:items-start'
              }
            >
              {repositoryFocusMode === 'detail' && selectedRepositoryItem ? (
                <div className="ui-surface rounded-[20px] px-4 py-4">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
                    Detail Focus
                  </div>
                  <div className="mt-2 text-xs leading-[1.5] text-neutral-600">
                    This tab was opened directly for the selected repository item.
                  </div>
                </div>
              ) : (
                <div className="grid max-h-[72vh] gap-3 overflow-y-auto pr-1 xl:min-h-[56vh]">
                  {repositoryFilteredItems.map((item) => (
                    <RepositoryItemCard
                      key={item.id}
                      href={buildRepositoryItemHref(item.id)}
                      itemType={item.itemType}
                      title={item.title}
                      meta={`${item.itemType} · ${item.teamLabel} · ${item.ownerLabel ?? 'system ownership'}`}
                      secondary={`${item.recordClass} · updated ${item.updatedAt?.slice(0, 10) ?? 'n/a'} · ${item.path}`}
                      status={item.status}
                      documentState={item.documentState}
                      documentVersion={item.documentVersion}
                      lastResponsible={item.lastResponsible}
                      selected={selectedRepositoryItem?.id === item.id}
                      onSelect={() => setSelectedRepositoryItemId(item.id)}
                      onOpen={item.relatedFileId ? () => setOpenFileId(item.relatedFileId ?? null) : null}
                    />
                  ))}

                  {repositoryFilteredItems.length === 0 ? (
                    <div className="ui-surface-subtle rounded-[18px] px-4 py-6 text-sm text-neutral-600">
                      No repository items match the current search and filters.
                    </div>
                  ) : null}
                </div>
              )}

              <div className="ui-surface-subtle rounded-[20px] px-4 py-4 xl:sticky xl:top-4">
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
                  Document Detail
                </div>

                {selectedRepositoryItem ? (
                  <RepositoryDetailPanel
                    item={selectedRepositoryItem}
                    href={buildRepositoryItemHref(selectedRepositoryItem.id)}
                    onOpenFile={() => setOpenFileId(selectedRepositoryItem.relatedFileId ?? null)}
                  />
                ) : (
                  <div className="mt-3 text-sm text-neutral-600">
                    Select a repository item to inspect its documentary metadata.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    ) : activeView === 'audit' ? (
      <div className="grid gap-4 sm:gap-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <DocumentationStatCard
            label="Audit Records"
            value={String(auditFilteredEntries.length)}
            meta="Operational audit rows derived from the same documentary base used by Repository View."
          />
          <DocumentationStatCard
            label="Controlled Docs"
            value={String(documentationModel.repositoryItems.filter((item) => item.documentState === 'Locked').length)}
            meta="Documents currently marked as locked inside the repository model."
          />
          <DocumentationStatCard
            label="Under Review"
            value={String(documentationModel.repositoryItems.filter((item) => item.documentState === 'Under Review').length)}
            meta="Documents still in active review according to the shared documentary state."
          />
          <DocumentationStatCard
            label="Audit Links"
            value={String(auditFilteredEntries.reduce((sum, entry) => sum + entry.auditEventIds.length, 0))}
            meta="Direct event references already linked to documentary rows."
          />
        </div>

        <div className="ui-surface rounded-[22px] px-4 py-4 sm:px-5">
          <div className="mb-3 flex items-center gap-3">
            <div className="text-sm font-semibold tracking-[0.08em] text-neutral-900">
              Audit Log
            </div>
            <div className="h-px flex-1 bg-neutral-200" />
          </div>
          <div className="grid gap-4">
            {false ? recentIndexEntries.map((entry) => (
              <div key={entry.id} className="ui-surface-subtle rounded-[16px] px-4 py-3 text-xs text-neutral-700">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-neutral-900">{entry.teamLabel}</span>
                  <span className="text-neutral-500">{entry.date}</span>
                </div>
                <div className="mt-2 leading-[1.5]">
                  {entry.entryKind} · {entry.agentLabel ?? 'system'} · status {entry.status}
                </div>
                <div className="mt-1 text-neutral-500">
                  origin {entry.origin ?? 'n/a'} · destination {entry.destination ?? 'n/a'}
                </div>
              </div>
            )) : (
              <>
                <div className="grid gap-3 xl:grid-cols-[repeat(4,minmax(0,1fr))]">
                  <label className="grid gap-1">
                    <span className="ui-label">Document state</span>
                    <select
                      className="ui-input text-xs"
                      value={auditStateFilter}
                      onChange={(event) => setAuditStateFilter(event.target.value)}
                    >
                      <option value="all">All states</option>
                      <option value="Draft">Draft</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Under Review">Under Review</option>
                      <option value="Approved">Approved</option>
                      <option value="Locked">Locked</option>
                    </select>
                  </label>

                  <label className="grid gap-1">
                    <span className="ui-label">Event type</span>
                    <select
                      className="ui-input text-xs"
                      value={auditEventFilter}
                      onChange={(event) => setAuditEventFilter(event.target.value)}
                    >
                      <option value="all">All events</option>
                      {auditEventOptions.map((event) => (
                        <option key={event.value} value={event.value}>
                          {event.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="grid gap-1">
                    <span className="ui-label">Responsible</span>
                    <select
                      className="ui-input text-xs"
                      value={auditResponsibleFilter}
                      onChange={(event) => setAuditResponsibleFilter(event.target.value)}
                    >
                      <option value="all">All responsible</option>
                      {auditResponsibleOptions.map((responsible) => (
                        <option key={responsible} value={responsible}>
                          {responsible}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="grid gap-1">
                    <span className="ui-label">Date</span>
                    <input
                      className="ui-input text-xs"
                      type="date"
                      value={auditDateFilter}
                      onChange={(event) => setAuditDateFilter(event.target.value)}
                    />
                  </label>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 pt-3">
                  <div className="text-xs text-neutral-600">
                    {auditFilteredEntries.length} audit records available from the shared documentary base.
                  </div>
                  <button
                    className="ui-button min-h-8 px-3 text-[11px] text-neutral-700"
                    onClick={() => {
                      setAuditStateFilter('all');
                      setAuditEventFilter('all');
                      setAuditResponsibleFilter('all');
                      setAuditDateFilter('');
                    }}
                  >
                    Reset audit filters
                  </button>
                </div>

                <div className="grid gap-3">
                  {auditFilteredEntries.map((entry) => (
                    <AuditEntryCard
                      key={entry.id}
                      entry={entry}
                      onOpenDocument={() => focusRepositoryDocument(entry.repositoryItemId)}
                      onOpenFile={
                        entry.relatedFileId &&
                        state.savedFiles.some((file) => file.id === entry.relatedFileId)
                          ? () => focusRepositoryDocument(entry.repositoryItemId, { openFile: true })
                          : undefined
                      }
                    />
                  ))}

                  {auditFilteredEntries.length === 0 ? (
                    <div className="ui-surface-subtle rounded-[18px] px-4 py-6 text-sm text-neutral-600">
                      No audit records match the current control filters.
                    </div>
                  ) : null}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    ) : activeView === 'investigate' ? (
      <div className="grid gap-4 sm:gap-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <DocumentationStatCard
            label="Threads"
            value={String(investigateThreads.length)}
            meta="Document threads reconstructed from the same shared documentary and audit base."
          />
          <DocumentationStatCard
            label="Timeline Groups"
            value={String(investigateTimelineGroups.length)}
            meta="Date buckets currently carrying meaningful documentary evolution."
          />
          <DocumentationStatCard
            label="Versioned Docs"
            value={String(investigateThreads.filter((thread) => thread.documentVersion && thread.documentVersion !== 'v1').length)}
            meta="Documents whose chronology already shows version progression."
          />
          <DocumentationStatCard
            label="Review Paths"
            value={String(investigateThreads.filter((thread) => thread.documentState === 'Under Review').length)}
            meta="Investigative lanes still in active review."
          />
        </div>

        <div className="ui-surface rounded-[22px] px-4 py-4 sm:px-5">
          <div className="mb-3 flex items-center gap-3">
            <div className="text-sm font-semibold tracking-[0.08em] text-neutral-900">
              Investigative Chronology
            </div>
            <div className="h-px flex-1 bg-neutral-200" />
          </div>
          <div className="grid gap-4">
            <div className="grid gap-3 xl:grid-cols-[repeat(5,minmax(0,1fr))]">
              <label className="grid gap-1">
                <span className="ui-label">Project</span>
                <select
                  className="ui-input text-xs"
                  value={investigateProjectFilter}
                  onChange={(event) => setInvestigateProjectFilter(event.target.value)}
                >
                  <option value="all">All projects</option>
                  {investigateProjectOptions.map((project) => (
                    <option key={project} value={project}>
                      {project}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1">
                <span className="ui-label">Team</span>
                <select
                  className="ui-input text-xs"
                  value={investigateTeamFilter}
                  onChange={(event) => setInvestigateTeamFilter(event.target.value)}
                >
                  <option value="all">All teams</option>
                  {investigateTeamOptions.map((team) => (
                    <option key={team.value} value={team.value}>
                      {team.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1">
                <span className="ui-label">Workspace</span>
                <select
                  className="ui-input text-xs"
                  value={investigateWorkspaceFilter}
                  onChange={(event) => setInvestigateWorkspaceFilter(event.target.value)}
                >
                  <option value="all">All workspaces</option>
                  {investigateWorkspaceOptions.map((workspace) => (
                    <option key={workspace} value={workspace}>
                      {workspace}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1">
                <span className="ui-label">Document type</span>
                <select
                  className="ui-input text-xs"
                  value={investigateKindFilter}
                  onChange={(event) => setInvestigateKindFilter(event.target.value)}
                >
                  <option value="all">All types</option>
                  {investigateKindOptions.map((kind) => (
                    <option key={kind} value={kind}>
                      {kind}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1">
                <span className="ui-label">Date</span>
                <input
                  className="ui-input text-xs"
                  type="date"
                  value={investigateDateFilter}
                  onChange={(event) => setInvestigateDateFilter(event.target.value)}
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 pt-3">
              <div className="text-xs text-neutral-600">
                {investigateThreads.length} investigative threads available from the shared documentary base.
              </div>
              <button
                className="ui-button min-h-8 px-3 text-[11px] text-neutral-700"
                onClick={() => {
                  setInvestigateProjectFilter('all');
                  setInvestigateTeamFilter('all');
                  setInvestigateWorkspaceFilter('all');
                  setInvestigateKindFilter('all');
                  setInvestigateDateFilter('');
                }}
              >
                Reset investigation filters
              </button>
            </div>

            <div className="grid gap-4">
              {investigateTimelineGroups.map((group) => (
                <div key={group.date} className="grid gap-3">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
                    {group.date === 'n/a' ? 'Undated context' : `Timeline block · ${group.date}`}
                  </div>
                  <div className="grid gap-3">
                    {group.threads.map((thread) => (
                      <InvestigationThreadCard
                        key={thread.repositoryItemId}
                        thread={thread}
                        onOpenDocument={() => focusRepositoryDocument(thread.repositoryItemId)}
                        onOpenFile={
                          thread.relatedFileId &&
                          state.savedFiles.some((file) => file.id === thread.relatedFileId)
                            ? () => focusRepositoryDocument(thread.repositoryItemId, { openFile: true })
                            : undefined
                        }
                      />
                    ))}
                  </div>
                </div>
              ))}

              {investigateTimelineGroups.length === 0 ? (
                <div className="ui-surface-subtle rounded-[18px] px-4 py-6 text-sm text-neutral-600">
                  No investigative chronology matches the selected context filters.
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    ) : (
      <div className="grid gap-4 sm:gap-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <DocumentationStatCard
            label="Visible Docs"
            value={String(knowledgeFilteredDocumentNodes.length)}
            meta="Controlled document slice currently rendered inside the relational map."
          />
          <DocumentationStatCard
            label="Visible Nodes"
            value={String(knowledgeGraph.nodes.length)}
            meta="Documents plus contextual nodes derived from the same documentary base."
          />
          <DocumentationStatCard
            label="Visible Relations"
            value={String(knowledgeGraph.edges.length)}
            meta="Real links currently shown between document, project, team, workspace, and type."
          />
          <DocumentationStatCard
            label="Audit-linked Docs"
            value={String(knowledgeFilteredDocumentNodes.filter((node) => node.auditLinked).length)}
            meta="Documents in the visible slice already carrying documentary audit linkage."
          />
        </div>

        <div className="ui-surface rounded-[22px] px-4 py-4 sm:px-5">
          <div className="mb-3 grid gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="text-sm font-semibold tracking-[0.08em] text-neutral-900">
                Knowledge Map
              </div>
              <div className="h-px min-w-[48px] flex-1 bg-neutral-200" />
            </div>
            <div className="grid gap-1">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
                Graph Focus Modes
              </div>
              <div className="flex flex-wrap gap-2">
                {KNOWLEDGE_FOCUS_MODE_OPTIONS.map((mode) => (
                  <button
                    key={mode.value}
                    className={`ui-button min-h-8 px-3 text-[11px] ${
                      knowledgeFocusMode === mode.value ? 'ui-button-primary text-white' : 'text-neutral-700'
                    }`}
                    onClick={() => setKnowledgeFocusMode(mode.value)}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="grid gap-3 xl:grid-cols-[repeat(4,minmax(0,1fr))]">
              <label className="grid gap-1">
                <span className="ui-label">Project focus</span>
                <select
                  className="ui-input text-xs"
                  value={knowledgeProjectFilter || 'all'}
                  onChange={(event) => setKnowledgeProjectFilter(event.target.value)}
                >
                  <option value="all">All projects</option>
                  {knowledgeProjectOptions.map((project) => (
                    <option key={project} value={project}>
                      {project}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1">
                <span className="ui-label">Team</span>
                <select
                  className="ui-input text-xs"
                  value={knowledgeTeamFilter}
                  onChange={(event) => setKnowledgeTeamFilter(event.target.value)}
                >
                  <option value="all">All teams</option>
                  {knowledgeTeamOptions.map((team) => (
                    <option key={team.value} value={team.value}>
                      {team.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1">
                <span className="ui-label">Workspace</span>
                <select
                  className="ui-input text-xs"
                  value={knowledgeWorkspaceFilter}
                  onChange={(event) => setKnowledgeWorkspaceFilter(event.target.value)}
                >
                  <option value="all">All workspaces</option>
                  {knowledgeWorkspaceOptions.map((workspace) => (
                    <option key={workspace} value={workspace}>
                      {workspace}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1">
                <span className="ui-label">Document type</span>
                <select
                  className="ui-input text-xs"
                  value={knowledgeTypeFilter}
                  onChange={(event) => setKnowledgeTypeFilter(event.target.value)}
                >
                  <option value="all">All document types</option>
                  {knowledgeTypeOptions.map((kind) => (
                    <option key={kind} value={kind}>
                      {kind}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 pt-3">
              <div className="text-xs text-neutral-600">
                Knowledge Map keeps one canvas and one documentary base, while the focus mode changes which relations are emphasized.
              </div>
              <button
                className="ui-button min-h-8 px-3 text-[11px] text-neutral-700"
                onClick={() => {
                  setKnowledgeFocusMode('documents');
                  setKnowledgeProjectFilter(selectedRepositoryDocumentProject ?? knowledgeProjectOptions[0] ?? 'all');
                  setKnowledgeTeamFilter('all');
                  setKnowledgeWorkspaceFilter('all');
                  setKnowledgeTypeFilter('all');
                }}
              >
                Reset map focus
              </button>
            </div>

            <div className="grid gap-4">
              <KnowledgeMapCanvas
                nodes={knowledgeGraph.nodes}
                edges={knowledgeGraph.edges}
                selectedNode={selectedKnowledgeNode}
                connectionCount={selectedKnowledgeNode ? knowledgeConnectionsByNodeId.get(selectedKnowledgeNode.id) ?? 0 : 0}
                onSelectNode={setSelectedKnowledgeNodeId}
                onOpenDocument={
                  selectedKnowledgeNode?.repositoryItemId
                    ? () => focusRepositoryDocument(selectedKnowledgeNode.repositoryItemId as string)
                    : undefined
                }
                onOpenFile={
                  selectedKnowledgeNode?.repositoryItemId && selectedKnowledgeNode.relatedFileId
                    ? () => focusRepositoryDocument(selectedKnowledgeNode.repositoryItemId as string, { openFile: true })
                    : undefined
                }
              />
            </div>

            {knowledgeGraph.nodes.length === 0 ? (
              <div className="ui-surface-subtle rounded-[18px] px-4 py-6 text-sm text-neutral-600">
                No knowledge map slice matches the selected context filters.
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );

  const documentationContent = (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-[var(--color-surface-soft)]">
      <div className="px-2 pb-2 pt-2 sm:px-3 sm:pt-3">
        <div className="ui-surface px-3 py-3 sm:px-4 sm:py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-center text-sm font-semibold tracking-[0.14em] text-neutral-900 sm:text-left">
                DOCUMENTATION MODE
              </div>
              <div className="mt-1 text-[11px] text-neutral-500">
                Multiple production views over one shared documentary base.
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                className="text-[11px] font-normal text-neutral-500 underline-offset-2 transition-colors hover:text-neutral-900 hover:underline"
                onClick={() => setShowManifestView(true)}
              >
                (Manif.)
              </button>
              <button
                className="ui-button ui-button-primary min-h-9 px-2.5 text-[11px] text-white sm:min-h-8"
                onClick={() => setShowNewProjectModal(true)}
              >
                + new project
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-3">
            <div className="flex flex-wrap gap-2">
              {documentationModel.views.map((view) => {
                const isActive = view.mode === activeView;
                return (
                  <button
                    key={view.mode}
                    className={`ui-button min-h-8 px-3 text-[11px] ${
                      isActive ? 'ui-button-primary text-white' : 'text-neutral-700'
                    }`}
                    onClick={() => setActiveView(view.mode)}
                  >
                    {getDocumentationViewLabel(view.mode)}
                  </button>
                );
              })}
            </div>

            <div className="ui-surface-subtle rounded-[18px] px-4 py-3">
              <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
                <span>{activeViewDefinition?.productRole === 'primary' ? 'Primary production view' : activeViewDefinition?.productRole === 'secondary' ? 'Secondary analytical view' : 'Supporting production view'}</span>
                <span className="text-neutral-300">|</span>
                <span>{activeViewDefinition?.label ?? getDocumentationViewLabel(activeView)}</span>
              </div>
              <div className="mt-2 text-xs leading-[1.5] text-neutral-700">
                {activeViewDefinition?.description ?? getDocumentationViewDescription(activeView)}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="scrollbar-thin flex-1 overflow-y-auto px-2 pb-3 sm:px-3 sm:pb-4" style={{ minHeight: 0 }}>
        {documentationViewContent}
      </div>
    </div>
  );

  return (
    <div className="app-page-shell h-full min-h-0 min-w-0 overflow-hidden px-2 py-2 sm:px-3 sm:py-3">
      <div className="mx-auto flex h-full min-h-0 w-full max-w-[1600px] flex-col gap-2">
        <div className="ui-surface app-short-landscape-flex flex items-center justify-between gap-3 px-3 py-2 sm:hidden">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
            Sub-Manager Panel
          </div>
          <button
            data-docs-manager-toggle
            className="ui-button min-h-9 px-3 text-xs text-neutral-700"
            onClick={() => setShowManagerMobile((value) => !value)}
          >
            {showManagerMobile ? 'Hide Sub-Manager' : 'Show Sub-Manager'}
          </button>
        </div>

        {showManagerMobile && (
          <div className="app-frame app-short-landscape-flex flex h-[46dvh] min-h-0 overflow-hidden sm:hidden">
            <AgentPanel agent="manager" managerDisplayName={subManagerLabel} />
          </div>
        )}

        <div className="app-frame app-short-landscape-flex flex min-h-0 flex-1 overflow-hidden sm:hidden">
          {documentationContent}
        </div>

        <div className="app-frame app-short-landscape-hide hidden min-h-0 flex-1 overflow-hidden sm:flex">
          <AgentPanel
            agent="manager"
            managerDisplayName={subManagerLabel}
            className="w-[280px] shrink-0 md:w-[320px] lg:w-[432px]"
          />
          <DividerRail />
          {documentationContent}
        </div>
      </div>

      {openFile && openProject && (
        <FileViewer
          file={openFile}
          projectName={openProject.name}
          metadata={
            openFileRepositoryItem
              ? {
                  documentType: openFileRepositoryItem.documentKind,
                  documentState: openFileRepositoryItem.documentState,
                  documentVersion: openFileRepositoryItem.documentVersion,
                  userLabel: openFileRepositoryItem.userLabel,
                  ownerLabel: openFileRepositoryItem.ownerLabel,
                  lastResponsible: openFileRepositoryItem.lastResponsible,
                  updatedAt: openFileRepositoryItem.updatedAt,
                  latestReference: openFileInvestigationThread?.lastSeen ?? openFileRepositoryItem.updatedAt,
                }
              : undefined
          }
          onClose={() => setOpenFileId(null)}
        />
      )}

      {showRepositoryDetailModal && selectedRepositoryItem && (
        <Modal
          title={`Repository Detail - ${selectedRepositoryItem.title}`}
          onClose={() => setShowRepositoryDetailModal(false)}
          width="max-w-3xl"
        >
          <RepositoryDetailPanel
            item={selectedRepositoryItem}
            href={buildRepositoryItemHref(selectedRepositoryItem.id)}
            onOpenFile={() => setOpenFileId(selectedRepositoryItem.relatedFileId ?? null)}
          />
        </Modal>
      )}

      {showNewProjectModal && (
        <Modal title="New project" onClose={() => setShowNewProjectModal(false)}>
          <div className="grid gap-3">
            <label className="grid gap-1">
              <span className="ui-label">Project name</span>
              <input
                className="ui-input text-xs"
                value={newProjectName}
                onChange={(event) => setNewProjectName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    handleCreateProject();
                  }
                }}
                autoFocus
              />
            </label>

            <div className="flex justify-end gap-2">
              <button
                className="ui-button text-neutral-700"
                onClick={() => setShowNewProjectModal(false)}
              >
                Cancel
              </button>
              <button
                className="ui-button ui-button-primary text-white"
                onClick={handleCreateProject}
              >
                Create
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showManifestView && (
        <Modal title="Documentation Mode Manifest" onClose={() => setShowManifestView(false)}>
          <div className="max-h-[72vh] overflow-y-auto pr-1">
            <div className="mb-3 text-[11px] uppercase tracking-[0.16em] text-neutral-500">
              Temporary internal reference
            </div>
            <pre className="whitespace-pre-wrap text-sm leading-6 text-neutral-800">
              {DOCUMENTATION_MODE_MANIFEST}
            </pre>
          </div>
        </Modal>
      )}

      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </div>
  );
}

function DocumentationStatCard({
  label,
  value,
  meta,
}: {
  label: string;
  value: string;
  meta: string;
}) {
  return (
    <div className="ui-surface-subtle rounded-[18px] px-4 py-4">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
        {label}
      </div>
      <div className="mt-2 text-[22px] font-semibold tracking-[-0.03em] text-neutral-900">{value}</div>
      <div className="mt-1 text-xs leading-[1.45] text-neutral-600">{meta}</div>
    </div>
  );
}

function InvestigationThreadCard({
  thread,
  onOpenDocument,
  onOpenFile,
}: {
  thread: InvestigationThread;
  onOpenDocument: () => void;
  onOpenFile?: () => void;
}) {
  const visibleChronology = [...thread.chronology].slice(-4).reverse();

  return (
    <div className="ui-surface-subtle rounded-[18px] px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-neutral-900">{thread.title}</div>
          <div className="mt-1 text-xs leading-[1.5] text-neutral-600">
            {thread.projectLabel ?? 'No project'} · {thread.teamLabel} · {thread.sourceWorkspace}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {thread.documentState ? (
            <div
              className={`rounded-full border px-2 py-1 text-[10px] font-semibold tracking-[0.08em] ${getDocumentStateClasses(
                thread.documentState,
              )}`}
            >
              {thread.documentState}
            </div>
          ) : null}
          {thread.documentVersion ? (
            <div className="rounded-full border border-neutral-200 bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-600">
              {thread.documentVersion}
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-3 grid gap-2 text-xs text-neutral-700 sm:grid-cols-2 xl:grid-cols-4">
        <DetailField label="USER" value={thread.userLabel ?? 'n/a'} />
        <DetailField label="Last Responsible" value={thread.lastResponsible ?? 'n/a'} />
        <DetailField label="Document Type" value={thread.documentKind ?? 'n/a'} />
        <DetailField label="Latest Reference" value={thread.lastSeen ?? 'n/a'} />
      </div>

      <div className="mt-4 grid gap-2">
        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
          Investigative sequence
        </div>
        {visibleChronology.map((entry) => (
          <div key={entry.id} className="rounded-[14px] border border-neutral-200 bg-white px-3 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-semibold text-neutral-900">{entry.eventLabel}</div>
              <div className="text-[11px] text-neutral-500">{entry.occurredAt ?? 'n/a'}</div>
            </div>
            <div className="mt-1 text-[11px] leading-[1.5] text-neutral-600">
              {entry.documentState ?? 'n/a'} · {entry.documentVersion ?? 'n/a'} ·{' '}
              {entry.responsibleLabel ?? thread.lastResponsible ?? 'n/a'}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          className="ui-button min-h-8 px-3 text-[11px] text-neutral-700"
          onClick={onOpenDocument}
        >
          Open in Repository View
        </button>
        {onOpenFile ? (
          <button
            className="ui-button ui-button-primary min-h-8 px-3 text-[11px] text-white"
            onClick={onOpenFile}
          >
            Open file
          </button>
        ) : null}
      </div>
    </div>
  );
}

function getKnowledgeNodeClasses(nodeType: KnowledgeGraphNode['nodeType']) {
  if (nodeType === 'document') return 'fill-white stroke-neutral-300';
  if (nodeType === 'project') return 'fill-sky-50 stroke-sky-200';
  if (nodeType === 'team') return 'fill-amber-50 stroke-amber-200';
  if (nodeType === 'workspace') return 'fill-emerald-50 stroke-emerald-200';
  if (nodeType === 'user') return 'fill-rose-50 stroke-rose-200';
  if (nodeType === 'folder') return 'fill-stone-100 stroke-stone-300';
  if (nodeType === 'saved-file') return 'fill-cyan-50 stroke-cyan-200';
  return 'fill-violet-50 stroke-violet-200';
}

function getKnowledgeEdgeStroke(edgeType: DocumentationKnowledgeEdge['edgeType']) {
  if (edgeType === 'belongs-to') return '#0f172a';
  if (edgeType === 'linked-to-team') return '#d97706';
  if (edgeType === 'created-in') return '#0f766e';
  return '#6d28d9';
}

function getKnowledgeNodeMeta(node: KnowledgeGraphNode) {
  if (node.nodeType === 'document' || node.nodeType === 'saved-file') {
    return `${node.documentState ?? 'n/a'} · ${node.documentVersion ?? 'n/a'}`;
  }
  if (node.nodeType === 'project') return 'Project context';
  if (node.nodeType === 'team') return 'Team context';
  if (node.nodeType === 'workspace') return 'Workspace context';
  if (node.nodeType === 'user') return 'Accountability lens';
  if (node.nodeType === 'folder') return 'Folder container';
  return 'Document type';
}

function getKnowledgeNodeJitter(seed: string) {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }

  return {
    x: (hash % 27) - 13,
    y: ((Math.floor(hash / 27) % 23) - 11),
  };
}

function KnowledgeMapCanvas({
  nodes,
  edges,
  selectedNode,
  connectionCount,
  onSelectNode,
  onOpenDocument,
  onOpenFile,
}: {
  nodes: KnowledgeGraphNode[];
  edges: DocumentationKnowledgeEdge[];
  selectedNode: KnowledgeGraphNode | null;
  connectionCount: number;
  onSelectNode: (nodeId: string) => void;
  onOpenDocument?: () => void;
  onOpenFile?: () => void;
}) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const pointerStateRef = useRef<
    | { mode: 'pan'; pointerId: number; startX: number; startY: number; originX: number; originY: number }
    | {
        mode: 'drag-node';
        pointerId: number;
        nodeId: string;
        startClientX: number;
        startClientY: number;
        startNodeX: number;
        startNodeY: number;
      }
    | null
  >(null);
  const baseLayout = useMemo(() => {
    const orderedTypes: KnowledgeGraphNode['nodeType'][] = [
      'workspace',
      'project',
      'team',
      'user',
      'folder',
      'document-type',
      'saved-file',
      'document',
    ];
    const positions = new Map<string, { x: number; y: number }>();
    let maxRows = 1;

    orderedTypes.forEach((nodeType, columnIndex) => {
      const columnNodes = nodes
        .filter((node) => node.nodeType === nodeType)
        .sort((left, right) => {
          if (nodeType === 'document') {
            return (right.updatedAt ?? '').localeCompare(left.updatedAt ?? '') || left.label.localeCompare(right.label);
          }
          return left.label.localeCompare(right.label);
        });

      maxRows = Math.max(maxRows, columnNodes.length);
      columnNodes.forEach((node, rowIndex) => {
        const jitter = getKnowledgeNodeJitter(node.id);
        const verticalWave = ((rowIndex + columnIndex) % 2 === 0 ? -1 : 1) * 8;
        positions.set(node.id, {
          x: 92 + columnIndex * 172 + jitter.x,
          y: 86 + rowIndex * 92 + verticalWave + jitter.y,
        });
      });
    });

    return {
      positions,
      width: 900,
      height: Math.max(400, maxRows * 92 + 120),
    };
  }, [nodes]);
  const [nodePositions, setNodePositions] = useState<Map<string, { x: number; y: number }>>(
    () => new Map(baseLayout.positions),
  );
  const [viewport, setViewport] = useState({ scale: 1, offsetX: 0, offsetY: 0 });
  const selectedNodeId = selectedNode?.id ?? null;

  useEffect(() => {
    setNodePositions((current) => {
      const next = new Map<string, { x: number; y: number }>();
      baseLayout.positions.forEach((position, id) => {
        next.set(id, current.get(id) ?? position);
      });
      return next;
    });
  }, [baseLayout.positions]);

  const handleWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const container = viewportRef.current;
    if (!container) {
      return;
    }

    const bounds = container.getBoundingClientRect();
    const cursorX = event.clientX - bounds.left;
    const cursorY = event.clientY - bounds.top;
    const zoomDelta = event.deltaY > 0 ? -0.08 : 0.08;

    setViewport((current) => {
      const nextScale = Math.min(2.2, Math.max(0.6, Number((current.scale + zoomDelta).toFixed(2))));
      if (nextScale === current.scale) {
        return current;
      }

      const worldX = (cursorX - current.offsetX) / current.scale;
      const worldY = (cursorY - current.offsetY) / current.scale;

      return {
        scale: nextScale,
        offsetX: cursorX - worldX * nextScale,
        offsetY: cursorY - worldY * nextScale,
      };
    });
  };

  const handleViewportPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }

    const target = event.target as HTMLElement;
    if (target.closest('[data-knowledge-node="true"]') || target.closest('[data-knowledge-map-action="true"]')) {
      return;
    }

    pointerStateRef.current = {
      mode: 'pan',
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: viewport.offsetX,
      originY: viewport.offsetY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleViewportPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const pointerState = pointerStateRef.current;
    if (!pointerState || pointerState.pointerId !== event.pointerId) {
      return;
    }

    if (pointerState.mode === 'pan') {
      setViewport((current) => ({
        ...current,
        offsetX: pointerState.originX + (event.clientX - pointerState.startX),
        offsetY: pointerState.originY + (event.clientY - pointerState.startY),
      }));
      return;
    }

    setNodePositions((current) => {
      const next = new Map(current);
      next.set(pointerState.nodeId, {
        x: pointerState.startNodeX + (event.clientX - pointerState.startClientX) / viewport.scale,
        y: pointerState.startNodeY + (event.clientY - pointerState.startClientY) / viewport.scale,
      });
      return next;
    });
  };

  const clearPointerState = (event: ReactPointerEvent<HTMLDivElement>) => {
    const pointerState = pointerStateRef.current;
    if (!pointerState || pointerState.pointerId !== event.pointerId) {
      return;
    }

    pointerStateRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleNodePointerDown = (event: ReactPointerEvent<SVGGElement>, node: KnowledgeGraphNode) => {
    if (event.button !== 0) {
      return;
    }

    event.stopPropagation();
    onSelectNode(node.id);
    const position = nodePositions.get(node.id) ?? baseLayout.positions.get(node.id);
    if (!position) {
      return;
    }

    pointerStateRef.current = {
      mode: 'drag-node',
      pointerId: event.pointerId,
      nodeId: node.id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startNodeX: position.x,
      startNodeY: position.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  return (
    <div
      ref={viewportRef}
      className="ui-surface-subtle relative min-h-[560px] overflow-hidden rounded-[22px] bg-[radial-gradient(circle_at_top_left,rgba(148,163,184,0.16),transparent_32%),linear-gradient(180deg,#fafaf9_0%,#f5f5f4_100%)] px-2 py-2"
      onWheel={handleWheel}
      onPointerDown={handleViewportPointerDown}
      onPointerMove={handleViewportPointerMove}
      onPointerUp={clearPointerState}
      onPointerCancel={clearPointerState}
      onPointerLeave={clearPointerState}
    >
      <div className="pointer-events-none absolute inset-x-4 top-4 z-10 flex items-start justify-between gap-3">
        <div className="max-w-[420px] rounded-full border border-neutral-200/80 bg-white/90 px-3 py-2 text-[11px] leading-[1.45] text-neutral-600 shadow-sm backdrop-blur">
          Wheel to zoom. Drag empty space to pan. Drag any node to reorganize the constellation.
        </div>
        <div className="rounded-full border border-neutral-200/80 bg-white/90 px-3 py-2 text-[11px] font-medium text-neutral-600 shadow-sm backdrop-blur">
          Scale {viewport.scale.toFixed(2)}x
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-4 left-4 z-10 max-w-[460px] rounded-[18px] border border-neutral-200/80 bg-white/92 px-4 py-3 shadow-sm backdrop-blur">
        {selectedNode ? (
          <div className="grid gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-neutral-200 bg-neutral-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-600">
                {selectedNode.nodeType.replace('-', ' ')}
              </span>
              <span className="text-xs text-neutral-500">{connectionCount} visible connection(s)</span>
            </div>
            <div className="text-sm font-semibold text-neutral-900">{selectedNode.label}</div>
            <div className="text-xs leading-[1.5] text-neutral-600">
              {[selectedNode.projectLabel, selectedNode.teamLabel, selectedNode.workspaceLabel]
                .filter((value): value is string => Boolean(value))
                .join(' · ') || selectedNode.description || 'No contextual metadata'}
            </div>
            <div className="flex flex-wrap gap-2 text-[11px] text-neutral-600">
              {selectedNode.documentState ? <span>State: {selectedNode.documentState}</span> : null}
              {selectedNode.documentVersion ? <span>Version: {selectedNode.documentVersion}</span> : null}
              {selectedNode.userLabel ? <span>USER: {selectedNode.userLabel}</span> : null}
              {selectedNode.lastResponsible ? <span>Responsible: {selectedNode.lastResponsible}</span> : null}
            </div>
            <div className="pointer-events-auto flex flex-wrap gap-2">
              {onOpenDocument ? (
                <button
                  data-knowledge-map-action="true"
                  className="ui-button min-h-8 px-3 text-[11px] text-neutral-700"
                  onClick={onOpenDocument}
                >
                  Open in Repository View
                </button>
              ) : null}
              {onOpenFile ? (
                <button
                  data-knowledge-map-action="true"
                  className="ui-button ui-button-primary min-h-8 px-3 text-[11px] text-white"
                  onClick={onOpenFile}
                >
                  Open file
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="text-xs text-neutral-600">Select a node to inspect its documentary context.</div>
        )}
      </div>

      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${baseLayout.width} ${baseLayout.height}`}
        className="min-h-[500px] w-full"
      >
        <g transform={`translate(${viewport.offsetX} ${viewport.offsetY}) scale(${viewport.scale})`}>
          {edges.map((edge) => {
            const source = nodePositions.get(edge.sourceId);
            const target = nodePositions.get(edge.targetId);
            if (!source || !target) {
              return null;
            }
            return (
              <g key={edge.id}>
                <line
                  x1={source.x}
                  y1={source.y}
                  x2={target.x}
                  y2={target.y}
                  stroke={getKnowledgeEdgeStroke(edge.edgeType)}
                  strokeWidth="1.2"
                  opacity="0.34"
                />
                <text
                  x={(source.x + target.x) / 2}
                  y={(source.y + target.y) / 2 - 6}
                  textAnchor="middle"
                  className="fill-neutral-400 text-[8px] uppercase tracking-[0.12em]"
                >
                  {edge.label}
                </text>
              </g>
            );
          })}

          {nodes.map((node) => {
            const position = nodePositions.get(node.id);
            if (!position) {
              return null;
            }
            const isSelected = node.id === selectedNodeId;
            const radius = node.nodeType === 'document' || node.nodeType === 'saved-file' ? 18 : 14;
            return (
              <g
                key={node.id}
                data-knowledge-node="true"
                transform={`translate(${position.x}, ${position.y})`}
                className="cursor-grab active:cursor-grabbing"
                onPointerDown={(event) => handleNodePointerDown(event, node)}
              >
                <circle
                  cx="0"
                  cy="0"
                  r={radius}
                  className={`${getKnowledgeNodeClasses(node.nodeType)} ${isSelected ? 'stroke-[var(--color-accent)]' : ''}`}
                  strokeWidth={isSelected ? 2.5 : 1.4}
                />
                {node.auditLinked ? <circle cx={radius - 3} cy={-radius + 4} r="3" className="fill-neutral-900" /> : null}
                <text x="0" y={radius + 16} textAnchor="middle" className="fill-neutral-900 text-[11px] font-semibold">
                  {node.label.length > 22 ? `${node.label.slice(0, 22)}…` : node.label}
                </text>
                <text x="0" y={radius + 28} textAnchor="middle" className="fill-neutral-500 text-[8px] uppercase tracking-[0.12em]">
                  {getKnowledgeNodeMeta(node)}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}

function AuditEntryCard({
  entry,
  onOpenDocument,
  onOpenFile,
}: {
  entry: DocumentationAuditEntry;
  onOpenDocument: () => void;
  onOpenFile?: () => void;
}) {
  return (
    <div className="ui-surface-subtle rounded-[18px] px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-neutral-900">{entry.documentTitle}</div>
          <div className="mt-1 text-xs leading-[1.5] text-neutral-600">
            {entry.teamLabel} · {entry.projectLabel ?? 'No project'} · {entry.recordClass}
          </div>
        </div>
        <div
          className={`rounded-full border px-2 py-1 text-[10px] font-semibold tracking-[0.08em] ${getAuditEventClasses(
            entry.eventKind,
          )}`}
        >
          {entry.eventLabel}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {entry.documentState ? (
          <div
            className={`rounded-full border px-2 py-1 text-[10px] font-semibold tracking-[0.08em] ${getDocumentStateClasses(
              entry.documentState,
            )}`}
          >
            {entry.documentState}
          </div>
        ) : null}
        {entry.documentVersion ? (
          <div className="rounded-full border border-neutral-200 bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-600">
            {entry.documentVersion}
          </div>
        ) : null}
      </div>

      <div className="mt-3 grid gap-2 text-xs text-neutral-700 sm:grid-cols-2">
        <DetailField label="USER" value={entry.userLabel ?? 'n/a'} />
        <DetailField label="Responsible" value={entry.responsibleLabel ?? 'n/a'} />
        <DetailField label="Reference Time" value={entry.occurredAt ?? 'n/a'} />
        <DetailField label="Source Workspace" value={entry.sourceWorkspace} />
        <DetailField
          label="Audit Linkage"
          value={entry.auditEventIds.length ? `${entry.auditEventIds.length} linked event(s)` : 'n/a'}
        />
      </div>

      <DetailField label="Path" value={entry.path} long />

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          className="ui-button min-h-8 px-3 text-[11px] text-neutral-700"
          onClick={onOpenDocument}
        >
          Open in Repository View
        </button>
        {onOpenFile ? (
          <button
            className="ui-button ui-button-primary min-h-8 px-3 text-[11px] text-white"
            onClick={onOpenFile}
          >
            Open file
          </button>
        ) : null}
      </div>
    </div>
  );
}

function RepositoryItemCard({
  href,
  itemType,
  title,
  meta,
  secondary,
  status,
  documentState,
  documentVersion,
  lastResponsible,
  selected,
  onSelect,
  onOpen,
}: {
  href: string;
  itemType: DocumentationRepositoryItem['itemType'];
  title: string;
  meta: string;
  secondary: string;
  status: string;
  documentState: DocumentationDocumentState | null;
  documentVersion: string | null;
  lastResponsible: string | null;
  selected: boolean;
  onSelect: () => void;
  onOpen?: (() => void) | null;
}) {
  const isDocument = itemType === 'file';
  const stateLabel = documentState ?? status;

  return (
    <div
      className={`ui-surface-subtle rounded-[18px] px-4 py-4 transition-colors ${
        selected ? 'ring-2 ring-[var(--color-accent)] ring-offset-1' : ''
      }`}
      onClick={onSelect}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <a
            href={href}
            className="text-sm font-semibold text-neutral-900 underline-offset-2 hover:underline"
            onClick={(event) => {
              event.preventDefault();
              onSelect();
            }}
          >
            {title}
          </a>
          <div className="mt-1 text-xs leading-[1.5] text-neutral-600">{meta}</div>
          {isDocument ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {documentState ? (
                <div
                  className={`rounded-full border px-2 py-1 text-[10px] font-semibold tracking-[0.08em] ${getDocumentStateClasses(
                    documentState,
                  )}`}
                >
                  {documentState}
                </div>
              ) : null}
              {documentVersion ? (
                <div className="rounded-full border border-neutral-200 bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-600">
                  {documentVersion}
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="mt-1 text-[11px] leading-[1.5] text-neutral-500">{secondary}</div>
          {isDocument && lastResponsible ? (
            <div className="mt-1 text-[11px] font-medium text-neutral-600">
              Last responsible: {lastResponsible}
            </div>
          ) : null}
        </div>
        {!isDocument ? (
          <div className="rounded-full border border-neutral-200 bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-600">
            {stateLabel}
          </div>
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <a
          href={href}
          target="_blank"
          rel="noreferrer noopener"
          className="ui-button inline-flex min-h-8 items-center px-3 text-[11px] text-neutral-700"
          onClick={(event) => event.stopPropagation()}
        >
          Open in new tab/window
        </a>
        {onOpen ? (
          <button className="ui-button min-h-8 px-3 text-[11px] text-neutral-700" onClick={onOpen}>
            Open item
          </button>
        ) : null}
      </div>
    </div>
  );
}

function RepositoryDetailPanel({
  item,
  href,
  onOpenFile,
}: {
  item: {
    id: string;
    itemType: string;
    sourceWorkspace: string;
    title: string;
    teamLabel: string;
    userLabel: string | null;
    ownerLabel: string | null;
    ownerRole: string | null;
    status: string;
    recordClass: string;
    updatedAt: string | null;
    projectLabel: string | null;
    sourceConversationLabel: string | null;
    auditEventIds: string[];
    checkpointLabel: string | null;
    versionCount: number | null;
    lockState: boolean | null;
    documentState: DocumentationDocumentState | null;
    documentVersion: string | null;
    lastResponsible: string | null;
    path: string;
    relatedFileId?: string;
  };
  href: string;
  onOpenFile: () => void;
}) {
  const isDocument = item.itemType === 'file';

  return (
    <div className="mt-3 grid gap-4">
      <div>
        <div className="text-base font-semibold tracking-[-0.02em] text-neutral-900">{item.title}</div>
        <div className="mt-1 text-xs leading-[1.5] text-neutral-600">
          {item.itemType} from {item.sourceWorkspace}
        </div>
      </div>

      <div className="grid gap-3 text-xs text-neutral-700 sm:grid-cols-2">
        <DetailField label="Team" value={item.teamLabel} />
        <DetailField label="USER" value={item.userLabel ?? 'n/a'} />
        <DetailField label="Owner" value={item.ownerLabel ?? 'System ownership'} />
        <DetailField label="Origin Agent" value={item.ownerRole ?? 'n/a'} />
        <DetailField label={isDocument ? 'Document State' : 'Status'} value={item.documentState ?? item.status} />
        {isDocument ? (
          <DetailField label="Version" value={item.documentVersion ?? 'n/a'} />
        ) : (
          <DetailField label="Versions" value={item.versionCount !== null ? String(item.versionCount) : 'n/a'} />
        )}
        <DetailField label="Last Responsible" value={item.lastResponsible ?? item.ownerLabel ?? 'n/a'} />
        <DetailField label="Class" value={item.recordClass} />
        <DetailField label="Updated" value={item.updatedAt?.slice(0, 10) ?? 'n/a'} />
        <DetailField label="Project" value={item.projectLabel ?? 'n/a'} />
        <DetailField label="Conversation Source" value={item.sourceConversationLabel ?? 'n/a'} />
        <DetailField
          label="Audit Linkage"
          value={item.auditEventIds.length ? `${item.auditEventIds.length} linked event(s)` : 'n/a'}
        />
        <DetailField label="Checkpoint" value={item.checkpointLabel ?? 'n/a'} />
        <DetailField
          label="Lock"
          value={item.lockState === null ? 'n/a' : item.lockState ? 'Locked' : 'Unlocked'}
        />
      </div>

      <DetailField label="Path" value={item.path} long />

      <div className="flex flex-wrap gap-2">
        {item.relatedFileId ? (
          <button
            className="ui-button ui-button-primary min-h-8 px-3 text-[11px] text-white"
            onClick={onOpenFile}
          >
            Open file
          </button>
        ) : null}
        <a
          href={href}
          target="_blank"
          rel="noreferrer noopener"
          className="ui-button inline-flex min-h-8 items-center px-3 text-[11px] text-neutral-700"
        >
          Open in new tab/window
        </a>
      </div>
    </div>
  );
}

function DetailField({
  label,
  value,
  long = false,
}: {
  label: string;
  value: string;
  long?: boolean;
}) {
  return (
    <div className={long ? 'grid gap-1' : 'grid gap-1'}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">{label}</div>
      <div className={`text-xs leading-[1.5] text-neutral-800 ${long ? 'break-all' : ''}`}>{value}</div>
    </div>
  );
}
