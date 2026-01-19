"""
BoardView component for Turkish Draughts.

Renders an 8x8 board with pieces and handles square click interactions.
Uses theme colors from ui/theme.py.
"""

import flet as ft
from typing import Optional, Callable, List, Tuple

from game.types import Piece, Player, PieceType, Move
from ui.theme import COLORS, SIZES


def create_board_view(
    board: List[List[Optional[Piece]]],
    selected: Optional[Tuple[int, int]] = None,
    valid_moves: Optional[List[Move]] = None,
    on_square_click: Optional[Callable[[int, int], None]] = None,
    current_player: Player = Player.WHITE,
    last_move: Optional[Move] = None,
) -> ft.Container:
    """
    Create a board view component.
    
    Args:
        board: 2D list representing board state
        selected: Currently selected square coordinates
        valid_moves: List of valid moves for selected piece
        on_square_click: Callback function(row, col) when square clicked
        current_player: Current player's turn
        last_move: The last move made (for highlighting)
        
    Returns:
        Flet Container with the board UI
    """
    valid_moves = valid_moves or []
    board_size = SIZES["board_size"]
    square_size = SIZES["square_size"]
    
    def is_valid_move_target(row: int, col: int) -> bool:
        """Check if this square is a valid move destination."""
        for move in valid_moves:
            if move.end == (row, col):
                return True
        return False
    
    def is_capture_target(row: int, col: int) -> bool:
        """Check if this square is part of a capture move."""
        for move in valid_moves:
            if move.end == (row, col) and move.captures:
                return True
            if (row, col) in move.captures:
                return True
        return False
    
    def handle_click(row: int, col: int):
        """Handle square click event."""
        if on_square_click:
            on_square_click(row, col)
    
    def create_piece_widget(piece: Piece) -> ft.Control:
        """Create a piece widget."""
        piece_size = SIZES["piece_size"]
        
        # Determine piece color
        if piece.player == Player.WHITE:
            piece_color = COLORS["piece_white"]
            shadow_color = COLORS["piece_white_shadow"]
        else:
            piece_color = COLORS["piece_black"]
            shadow_color = "#000000"
        
        # Create crown icon for kings
        crown = None
        if piece.type == PieceType.KING:
            crown = ft.Icon(
                ft.Icons.STAR,
                color=COLORS["accent_amber"],
                size=SIZES["crown_size"],
            )
        
        # Create piece container with 3D effect
        return ft.Container(
            width=piece_size,
            height=piece_size,
            bgcolor=piece_color,
            border_radius=piece_size // 2,
            border=ft.border.all(
                SIZES["piece_border"],
                shadow_color,
            ),
            shadow=ft.BoxShadow(
                spread_radius=1,
                blur_radius=6,
                color="#00000099",
                offset=ft.Offset(0, 4),
            ),
            content=crown,
            alignment=ft.Alignment(0, 0),
        )
    
    def create_square(row: int, col: int) -> ft.Container:
        """Create a single board square with piece if present."""
        # Determine square color (alternating pattern)
        is_light = (row + col) % 2 == 0
        base_color = COLORS["board_light"] if is_light else COLORS["board_dark"]
        
        # Check for special highlighting
        bg_color = base_color
        border = None
        
        # Selected piece highlight
        if selected and selected == (row, col):
            bg_color = COLORS["selected"]
            border = ft.border.all(3, COLORS["primary_glow"])
        
        # Valid move indicator
        elif is_valid_move_target(row, col):
            if is_capture_target(row, col):
                # Capture target - red highlight
                border = ft.border.all(2, COLORS["capture_target"])
            else:
                # Regular move - green indicator
                border = ft.border.all(2, COLORS["valid_move"])
        
        # Last move highlight
        elif last_move:
            if (row, col) == last_move.start or (row, col) == last_move.end:
                border = ft.border.all(2, COLORS["last_move"])
        
        # Get piece at this position
        piece = board[row][col] if board else None
        
        # Create piece widget if present
        content = None
        if piece:
            content = create_piece_widget(piece)
        elif is_valid_move_target(row, col) and not is_capture_target(row, col):
            # Valid move dot indicator for empty squares
            content = ft.Container(
                width=square_size // 4,
                height=square_size // 4,
                bgcolor=COLORS["valid_move"],
                border_radius=square_size // 8,
            )
        
        # Create square container
        return ft.Container(
            width=square_size,
            height=square_size,
            bgcolor=bg_color,
            border=border,
            content=content,
            alignment=ft.Alignment(0, 0),
            on_click=lambda e, r=row, c=col: handle_click(r, c),
        )
    
    # Create grid of squares
    rows = []
    for row in range(board_size):
        row_controls = []
        for col in range(board_size):
            square = create_square(row, col)
            row_controls.append(square)
        rows.append(ft.Row(row_controls, spacing=0))
    
    # Wrap in container with board styling
    board_container = ft.Container(
        content=ft.Column(rows, spacing=0),
        bgcolor=COLORS["board_frame"],
        padding=SIZES["board_padding"],
        border_radius=SIZES["radius_lg"],
        shadow=ft.BoxShadow(
            spread_radius=1,
            blur_radius=50,
            color="#00000080",
            offset=ft.Offset(0, 20),
        ),
    )
    
    return board_container
