"""
MoveHistory component for Turkish Draughts.

Displays scrollable list of moves made in the game.
Uses theme colors from ui/theme.py.
"""

import flet as ft
from typing import List

from game.types import MoveRecord, Player
from ui.theme import COLORS, SIZES


def create_move_history(
    moves: List[MoveRecord],
    max_height: int = 300,
) -> ft.Container:
    """
    Create a move history list component.
    
    Args:
        moves: List of MoveRecord objects
        max_height: Maximum height of scrollable area
        
    Returns:
        Flet Container with the move history UI
    """
    
    def format_move(record: MoveRecord) -> str:
        """Format a move record for display."""
        start = record.move.start
        end = record.move.end
        
        # Convert to algebraic notation (e.g., "a1-b2")
        start_col = chr(ord('a') + start[1])
        start_row = str(8 - start[0])
        end_col = chr(ord('a') + end[1])
        end_row = str(8 - end[0])
        
        notation = f"{start_col}{start_row}-{end_col}{end_row}"
        
        # Add capture indicator
        if record.move.captures:
            notation += f" x{len(record.move.captures)}"
        
        return notation
    
    def create_move_row(record: MoveRecord) -> ft.Container:
        """Create a single move row."""
        # Determine player color indicator
        if record.player == Player.WHITE:
            player_color = COLORS["piece_white"]
            player_icon = ft.Container(
                width=12,
                height=12,
                bgcolor=player_color,
                border=ft.border.all(1, COLORS["text_gray"]),
                border_radius=6,
            )
        else:
            player_color = COLORS["piece_black"]
            player_icon = ft.Container(
                width=12,
                height=12,
                bgcolor=player_color,
                border=ft.border.all(1, COLORS["text_gray"]),
                border_radius=6,
            )
        
        # Move number
        move_num = ft.Text(
            f"{record.move_number}.",
            size=SIZES["font_sm"],
            color=COLORS["text_gray"],
            width=30,
        )
        
        # Move notation
        notation = format_move(record)
        is_capture = bool(record.move.captures)
        
        move_text = ft.Text(
            notation,
            size=SIZES["font_sm"],
            color=COLORS["accent_red"] if is_capture else COLORS["text_white"],
            weight=ft.FontWeight.BOLD if is_capture else ft.FontWeight.NORMAL,
        )
        
        # Row container
        return ft.Container(
            content=ft.Row(
                [
                    move_num,
                    player_icon,
                    ft.Container(width=SIZES["spacing_xs"]),
                    move_text,
                ],
                alignment=ft.MainAxisAlignment.START,
            ),
            padding=ft.padding.symmetric(
                horizontal=SIZES["spacing_sm"],
                vertical=SIZES["spacing_xs"],
            ),
            border_radius=SIZES["radius_sm"],
            bgcolor=COLORS["surface"] if record.move_number % 2 == 0 else None,
        )
    
    # Create move rows
    move_rows = [create_move_row(record) for record in moves]
    
    # Empty state
    if not move_rows:
        empty_message = ft.Container(
            content=ft.Text(
                "No moves yet",
                size=SIZES["font_sm"],
                color=COLORS["text_muted"],
                italic=True,
            ),
            alignment=ft.Alignment(0, 0),
            padding=SIZES["spacing_md"],
        )
        move_rows = [empty_message]
    
    # Header
    header = ft.Container(
        content=ft.Text(
            "Move History",
            size=SIZES["font_md"],
            weight=ft.FontWeight.BOLD,
            color=COLORS["text_white"],
        ),
        padding=ft.padding.only(
            left=SIZES["spacing_sm"],
            bottom=SIZES["spacing_sm"],
        ),
    )
    
    # Scrollable list
    move_list = ft.Column(
        move_rows,
        spacing=2,
        scroll=ft.ScrollMode.AUTO,
        auto_scroll=True,  # Auto-scroll to latest move
    )
    
    # Wrap in container with styling
    history_container = ft.Container(
        content=ft.Column(
            [
                header,
                ft.Container(
                    content=move_list,
                    height=max_height,
                    bgcolor=COLORS["bg_dark"],
                    border_radius=SIZES["radius_sm"],
                    padding=SIZES["spacing_xs"],
                ),
            ],
            spacing=0,
        ),
        bgcolor=COLORS["surface"],
        border=ft.border.all(1, COLORS["glass_border"]),
        border_radius=SIZES["radius_md"],
        padding=SIZES["spacing_sm"],
    )
    
    return history_container
