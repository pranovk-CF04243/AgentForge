import React, { useMemo } from 'react';
import { useStore } from '../../store/useStore';
import { AGENT_COORDINATES } from './AgentSprite';

interface FlowLink {
  id: string;
  sourceId: string;
  targetId: string;
  label: string;
  color: string;
}

export const CollabGraph: React.FC = () => {
  const tasks = useStore((state) => state.tasks);
  const incidents = useStore((state) => state.incidents);

  // Compute live collaboration links from active tasks and incidents
  const links = useMemo<FlowLink[]>(() => {
    const activeLinks: FlowLink[] = [];

    // 1. Check for running tasks
    Object.values(tasks).forEach((task) => {
      if (task.status === 'RUNNING' && task.assignedTo) {
        const assignedAgent = task.assignedTo;

        // Dependency link: If task has dependencies, link from upstream agent
        if (task.dependencies && task.dependencies.length > 0) {
          const depTaskId = task.dependencies[0];
          const depTask = tasks[depTaskId];
          if (depTask && depTask.assignedTo && depTask.assignedTo !== assignedAgent) {
            activeLinks.push({
              id: `flow-${depTask.assignedTo}-${assignedAgent}`,
              sourceId: depTask.assignedTo,
              targetId: assignedAgent,
              label: 'DATA HANDOFF',
              color: '#38bdf8',
            });
            return;
          }
        }

        // PM Task Assignment Flow
        if (assignedAgent !== 'agent-pm') {
          let label = 'ASSIGN TASK';
          let color = '#22c55e';

          if (assignedAgent === 'agent-arch') {
            label = 'SYSTEM SPEC';
            color = '#38bdf8';
          } else if (assignedAgent === 'agent-backend') {
            label = 'EXECUTE CODE';
            color = '#10b981';
          } else if (assignedAgent === 'agent-qa') {
            label = 'RUN TESTS';
            color = '#ec4899';
          } else if (assignedAgent === 'agent-reviewer') {
            label = 'CODE REVIEW';
            color = '#a855f7';
          }

          activeLinks.push({
            id: `assign-pm-${assignedAgent}`,
            sourceId: 'agent-pm',
            targetId: assignedAgent,
            label,
            color,
          });
        }
      }
    });

    // 2. Incident flow to SRE
    if (Object.keys(incidents).length > 0) {
      activeLinks.push({
        id: 'incident-alert-sre',
        sourceId: 'agent-sec',
        targetId: 'agent-sre',
        label: 'SEV-1 ALERT',
        color: '#ef4444',
      });
    }

    // Fallback active demonstration links if no task is currently running
    if (activeLinks.length === 0) {
      activeLinks.push(
        {
          id: 'demo-pm-backend',
          sourceId: 'agent-pm',
          targetId: 'agent-backend',
          label: 'ASSIGN SPRINT GOAL',
          color: '#38bdf8',
        },
        {
          id: 'demo-arch-frontend',
          sourceId: 'agent-arch',
          targetId: 'agent-frontend',
          label: 'DISPATCH API SPEC',
          color: '#22c55e',
        }
      );
    }

    return activeLinks;
  }, [tasks, incidents]);

  return (
    <g id="collaboration-graph-layer">
      <defs>
        <style>
          {`
            @keyframes flowDash {
              to {
                stroke-dashoffset: -48;
              }
            }
            .flow-line {
              animation: flowDash 1.4s linear infinite;
            }
          `}
        </style>
      </defs>

      {links.map((link) => {
        const source = AGENT_COORDINATES[link.sourceId];
        const target = AGENT_COORDINATES[link.targetId];
        if (!source || !target) return null;

        const dx = target.x - source.x;
        const dist = Math.abs(dx);
        const midX = (source.x + target.x) / 2;
        // Natural curved arc that arches upwards based on distance
        const arcHeight = Math.min(120, Math.max(40, dist * 0.12));
        const midY = Math.min(source.y, target.y) - arcHeight;

        const pathData = `M ${source.x} ${source.y - 20} Q ${midX} ${midY} ${target.x} ${target.y - 20}`;

        return (
          <g key={link.id}>
            {/* Soft Ambient Glow */}
            <path
              d={pathData}
              fill="none"
              stroke={link.color}
              strokeWidth="8"
              opacity="0.18"
            />

            {/* Animated Flowing Dashed Arrow */}
            <path
              d={pathData}
              fill="none"
              stroke={link.color}
              strokeWidth="2.5"
              strokeDasharray="8 6"
              className="flow-line"
            />

            {/* Traveling Data Packet Dot */}
            <circle r="4.5" fill={link.color} filter="drop-shadow(0 0 4px #fff)">
              <animateMotion
                path={pathData}
                dur="2.4s"
                repeatCount="indefinite"
              />
            </circle>

            {/* Label Badge at Peak of Arc */}
            <g transform={`translate(${midX}, ${midY})`}>
              <rect
                x="-54"
                y="-11"
                width="108"
                height="22"
                rx="6"
                fill="#0f172a"
                stroke={link.color}
                strokeWidth="1.5"
                filter="drop-shadow(0 3px 6px rgba(0,0,0,0.5))"
              />
              <text
                x="0"
                y="3"
                textAnchor="middle"
                fill="#f8fafc"
                fontSize="8"
                fontWeight="bold"
                fontFamily="monospace"
                letterSpacing="0.6px"
              >
                {link.label}
              </text>
            </g>
          </g>
        );
      })}
    </g>
  );
};
