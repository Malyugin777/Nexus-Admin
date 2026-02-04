"""
VPN Nodes management API.
Manage Marzban Edge Nodes cluster.
"""
import logging
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..auth import get_current_user
from ..marzban_api import marzban_api, MarzbanAPIError

logger = logging.getLogger(__name__)

router = APIRouter()


class NodeCreate(BaseModel):
    """Schema for creating a new node."""
    name: str
    address: str
    port: int = 62050
    api_port: int = 62051
    usage_coefficient: float = 1.0


@router.get("")
async def get_nodes_status(_=Depends(get_current_user)):
    """
    GET /api/v1/nodes

    Returns master node stats and list of all edge nodes.
    """
    try:
        system_stats = await marzban_api.get_system_stats()
        nodes = await marzban_api.get_nodes()
        return {
            "system_stats": system_stats,
            "nodes": nodes,
        }
    except MarzbanAPIError as e:
        logger.error(f"Failed to get nodes: {e.message}")
        raise HTTPException(status_code=e.status_code or 500, detail=e.message)


@router.post("")
async def add_node(node: NodeCreate, _=Depends(get_current_user)):
    """
    POST /api/v1/nodes

    Add a new edge node to Marzban cluster.
    """
    try:
        result = await marzban_api.add_node(
            name=node.name,
            address=node.address,
            port=node.port,
            api_port=node.api_port,
            usage_coefficient=node.usage_coefficient,
        )
        logger.info(f"Added node: {node.name} ({node.address})")
        return result
    except MarzbanAPIError as e:
        logger.error(f"Failed to add node {node.name}: {e.message}")
        raise HTTPException(status_code=e.status_code or 500, detail=e.message)


@router.delete("/{node_id}")
async def delete_node(node_id: int, _=Depends(get_current_user)):
    """
    DELETE /api/v1/nodes/{node_id}

    Remove a node from Marzban cluster.
    """
    try:
        result = await marzban_api.delete_node(node_id)
        logger.info(f"Deleted node: {node_id}")
        return result
    except MarzbanAPIError as e:
        logger.error(f"Failed to delete node {node_id}: {e.message}")
        raise HTTPException(status_code=e.status_code or 500, detail=e.message)


@router.post("/{node_id}/reconnect")
async def reconnect_node(node_id: int, _=Depends(get_current_user)):
    """
    POST /api/v1/nodes/{node_id}/reconnect

    Reconnect a node.
    """
    try:
        result = await marzban_api.reconnect_node(node_id)
        logger.info(f"Reconnected node: {node_id}")
        return result
    except MarzbanAPIError as e:
        logger.error(f"Failed to reconnect node {node_id}: {e.message}")
        raise HTTPException(status_code=e.status_code or 500, detail=e.message)
