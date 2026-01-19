"""
Game Screen for Turkish Draughts.

Main gameplay screen with board, timers, move history, and controls.
"""

import flet as ft
from typing import Callable, Optional, List, Tuple

from game.types import Player, Move, MoveRecord, GameSettings, GameMode
from game.state import GameState
from ui.theme import COLORS, SIZES
from ui.components.board_view import create_board_view
from ui.components.timer import create_timer_display
from ui.components.move_history import create_move_history
from ui.components.captured import create_captured_pieces


def create_game_screen(
    game_state: GameState,
    on_undo: Optional[Callable[[], None]] = None,
    on_forfeit: Optional[Callable[[], None]] = None,
    on_game_over: Optional[Callable[[], None]] = None,
) -> ft.Container:
    """
    Create the game screen.
    
    Args:
        game_state: The current game state
        on_undo: Callback for undo button
        on_forfeit: Callback for forfeit button
        on_game_over: Callback when game ends
        
    Returns:
        Flet Container with the game UI
    """
    # State for selection
    selected_square: dict = {"value": None}
    valid_moves: dict = {"value": []}
    ai_thinking: dict = {"value": False}
    last_move: dict = {"value": None}
    
    # Reference to main content for rebuilding
    content_ref = ft.Ref[ft.Column]()
    
    def handle_square_click(row: int, col: int):
        """Handle click on a board square."""
        if not game_state.board or game_state.is_game_over():
            return
        
        # Don't allow moves during AI's turn
        if game_state.is_ai_turn():
            return
        
        piece = game_state.board.get_piece_at(row, col)
        current_player = game_state.board.current_player
        
        # If clicking on own piece, select it
        if piece and piece.player == current_player:
            selected_square["value"] = (row, col)
            valid_moves["value"] = game_state.board.get_valid_moves_for_piece(row, col)
            rebuild_ui()
            return
        
        # If a piece is selected and clicking on valid move target
        if selected_square["value"]:
            for move in valid_moves["value"]:
                if move.end == (row, col):
                    # Execute move
                    execute_move(move)
                    return
        
        # Deselect
        selected_square["value"] = None
        valid_moves["value"] = []
        rebuild_ui()
    
    def execute_move(move: Move):
        """Execute a move and handle aftermath."""
        success = game_state.execute_move(move)
        if success:
            last_move["value"] = move
            selected_square["value"] = None
            valid_moves["value"] = []
            
            # Check for game over
            if game_state.is_game_over():
                rebuild_ui()
                if on_game_over:
                    on_game_over()
                return
            
            rebuild_ui()
            
            # If it's now AI's turn, trigger AI move
            if game_state.is_ai_turn():
                trigger_ai_move()
    
    def trigger_ai_move():
        """Trigger AI to make a move."""
        ai_thinking["value"] = True
        rebuild_ui()
        
        # Get AI move
        ai_move = game_state.get_ai_move()
        if ai_move:
            game_state.execute_move(ai_move)
            last_move["value"] = ai_move
        
        ai_thinking["value"] = False
        
        # Check for game over
        if game_state.is_game_over():
            rebuild_ui()
            if on_game_over:
                on_game_over()
            return
        
        rebuild_ui()
    
    def rebuild_ui():
        """Rebuild the UI with current state."""
        if content_ref.current:
            content_ref.current.controls = build_content()
            content_ref.current.update()
    
    def build_player_bar(player: Player, is_top: bool) -> ft.Container:
        """Build a player info bar."""
        is_current = (
            game_state.board and 
            game_state.board.current_player == player
        )
        
        # Determine time for this player
        time_val = (
            game_state.white_time if player == Player.WHITE 
            else game_state.black_time
        )
        
        # Player label
        if game_state.settings:
            if game_state.settings.mode == GameMode.AI:
                if player == game_state.settings.player_side:
                    label = "You"
                else:
                    label = "AI"
            else:
                label = "White" if player == Player.WHITE else "Black"
        else:
            label = "White" if player == Player.WHITE else "Black"
        
        # Timer
        timer = create_timer_display(
            time_seconds=time_val,
            is_active=is_current,
            player_name=label,
            show_warning=time_val is not None and time_val <= 30,
        )
        
        # Turn indicator
        turn_indicator = None
        if is_current:
            turn_indicator = ft.Container(
                content=ft.Text(
                    "Your Turn" if (
                        game_state.settings and 
                        game_state.settings.mode == GameMode.AI and 
                        player == game_state.settings.player_side
                    ) else ("AI Thinking..." if ai_thinking["value"] else "●"),
                    size=SIZES["font_sm"],
                    color=COLORS["accent_green"],
                ),
                padding=ft.padding.only(left=SIZES["spacing_md"]),
            )
        
        return ft.Container(
            content=ft.Row(
                [
                    timer,
                    turn_indicator if turn_indicator else ft.Container(),
                ],
                alignment=ft.MainAxisAlignment.START,
            ),
            padding=ft.padding.symmetric(
                horizontal=SIZES["spacing_md"],
                vertical=SIZES["spacing_sm"],
            ),
        )
    
    def build_content() -> List[ft.Control]:
        """Build the screen content."""
        if not game_state.board:
            return [ft.Text("No game loaded", color=COLORS["text_white"])]
        
        # Determine which player is at top (opponent) and bottom (current human)
        if game_state.settings and game_state.settings.mode == GameMode.AI:
            human_side = game_state.settings.player_side
            ai_side = Player.BLACK if human_side == Player.WHITE else Player.WHITE
            top_player = ai_side
            bottom_player = human_side
        else:
            # Local mode: Black on top, White on bottom
            top_player = Player.BLACK
            bottom_player = Player.WHITE
        
        # Top player bar
        top_bar = build_player_bar(top_player, is_top=True)
        
        # Board
        board = create_board_view(
            board=game_state.board.board,
            selected=selected_square["value"],
            valid_moves=valid_moves["value"],
            on_square_click=handle_square_click,
            current_player=game_state.board.current_player,
            last_move=last_move["value"],
        )
        
        # Bottom player bar
        bottom_bar = build_player_bar(bottom_player, is_top=False)
        
        # Sidebar components
        captured = create_captured_pieces(game_state.get_capture_counts())
        history = create_move_history(game_state.get_move_history(), max_height=200)
        
        sidebar = ft.Container(
            content=ft.Column(
                [
                    captured,
                    ft.Container(height=SIZES["spacing_md"]),
                    history,
                ],
                spacing=0,
            ),
            width=SIZES["sidebar_width"],
            padding=SIZES["spacing_sm"],
        )
        
        # Control buttons
        undo_button = ft.Container(
            content=ft.Row(
                [
                    ft.Icon(ft.Icons.UNDO, color=COLORS["text_white"], size=20),
                    ft.Text("Undo", color=COLORS["text_white"], size=SIZES["font_sm"]),
                ],
                spacing=SIZES["spacing_xs"],
            ),
            bgcolor=COLORS["surface"],
            border=ft.border.all(1, COLORS["glass_border"]),
            border_radius=SIZES["radius_md"],
            padding=ft.padding.symmetric(horizontal=SIZES["spacing_md"], vertical=SIZES["spacing_sm"]),
            on_click=lambda e: on_undo() if on_undo else None,
        )
        
        forfeit_button = ft.Container(
            content=ft.Row(
                [
                    ft.Icon(ft.Icons.FLAG, color=COLORS["text_white"], size=20),
                    ft.Text("Forfeit", color=COLORS["text_white"], size=SIZES["font_sm"]),
                ],
                spacing=SIZES["spacing_xs"],
            ),
            bgcolor=COLORS["accent_red"],
            border_radius=SIZES["radius_md"],
            padding=ft.padding.symmetric(horizontal=SIZES["spacing_md"], vertical=SIZES["spacing_sm"]),
            on_click=lambda e: on_forfeit() if on_forfeit else None,
        )
        
        controls = ft.Container(
            content=ft.Row(
                [undo_button, forfeit_button],
                alignment=ft.MainAxisAlignment.CENTER,
                spacing=SIZES["spacing_md"],
            ),
            padding=SIZES["spacing_md"],
        )
        
        # Main layout
        main_area = ft.Row(
            [
                # Board section
                ft.Column(
                    [
                        top_bar,
                        board,
                        bottom_bar,
                    ],
                    horizontal_alignment=ft.CrossAxisAlignment.CENTER,
                    spacing=0,
                ),
                # Sidebar
                sidebar,
            ],
            alignment=ft.MainAxisAlignment.CENTER,
            vertical_alignment=ft.CrossAxisAlignment.START,
        )
        
        return [main_area, controls]
    
    # Build initial content
    initial_content = build_content()
    
    # Main container
    game_container = ft.Container(
        content=ft.Column(
            ref=content_ref,
            controls=initial_content,
            horizontal_alignment=ft.CrossAxisAlignment.CENTER,
            alignment=ft.MainAxisAlignment.CENTER,
            spacing=0,
        ),
        bgcolor=COLORS["bg_dark"],
        padding=SIZES["spacing_md"],
        expand=True,
    )
    
    return game_container
