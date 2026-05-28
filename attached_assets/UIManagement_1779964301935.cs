using System;
using System.Linq;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

public class UIManagement : MonoBehaviour
{
    public static UIManagement singleton;
    public Canvas canvas;
    public Canvas[] allPanels;

    [HideInInspector] public Player player;
    
    #region Players
    public Transform playerContent;
    public Button playerSlotPrefab;

    public TMP_Text onlineValueText;                // displays how many players are online
    public TMP_InputField nameInput;                // keyword searching
    public Button nextButton;
    public Button prevButton;

    [HideInInspector] public string[] online;       // names of all currently logged in players (in search mode only selected names), sorted 10 per page
    [HideInInspector] public string currentName;    // selected player
    [HideInInspector] public int onlineCount;       // number of names (in search mode is different)

    int page;                                       // current page
    bool checkPage;                                 // necessary for the pages to work properly in search mode

    int currentButton = -1;                         // current player button

    int _onlineValue;
    public int OnlineValue                          // how many players are online
    {
        get { return _onlineValue; }
        set
        {
            // update is called after online value changes
            if (_onlineValue != value)
            {
                _onlineValue = value;
                onlineValueText.text = value.ToString();
            }
        }
    }
    #endregion

    public Button itemsButton;
    public Button commandsButton;
    public Button noteButton;

#if UMMORPG_2D_C || UMMORPG_2D_R
    [HideInInspector] public Grid grid;
#endif

    void Awake()
    {
        // initialize singleton
        if (singleton == null) singleton = this;

#if UMMORPG_2D_C || UMMORPG_2D_R
        grid = FindObjectOfType<Grid>();
#endif
    }

    void Update()
    {
        if (Input.GetKeyDown(MToolsSettings.Settings.mainPanelKey) && !UIUtils.AnyInputActive())
        {
            if (!player) player = Player.localPlayer;

            if (player != null)
            {
                // requires special access
                if (player.CheckAccess())
                {
                    canvas.enabled = !canvas.enabled;

                    if (canvas.enabled)
                    {
                        ShowOnline();
                        //Debug.Log("panel[active]");

                        // instantiate an object if header with the name is active
                        UICreator.singleton.RestoreObject();
                    }
                    else
                    {
                        // close all open panels
                        ClosePanels();
                    }
                }
            }
        }
    }

    // invoked when the value of the text field changes
    public void KeywordSearching()
    {
        // update is called after clearing the text field
        if (string.IsNullOrWhiteSpace(nameInput.text))
        {
            if (!checkPage) checkPage = true;

            // if there was only one player on the current page and just logged out
            // return to the start page and update
            if (page > 0 && online.Length == 0)
            {
                page = 0;
                //Debug.Log("first page");
            }

            Clear();

            // update is called after online value changes
            ShowOnline();
        }
        else
        {
            // search mode
            if (page > 0 && checkPage)
            {
                page = 0;
                //Debug.Log("first page");
                checkPage = false;
            }

            Clear();

            // update is called if you enter text
            SearchOnline();

            // but also after online value changes,
            // to avoid issues in open search mode
        }
    }

    public void NextPage()
    {
        // update list after page changes
        page++;
        player.CmdShowOnline(page);
    }

    public void PreviousPage()
    {
        // update list after page changes
        page--;
        player.CmdShowOnline(page);
    }

    void ClosePanel(Canvas panel)
    {
        if (panel.enabled)
        {
            if (panel == UICommands.singleton.canvas)
            {
                UICommands.singleton.CancelInspect();
            }
            else if (panel == UITeleportMap.singleton.canvas)
            {
                UITeleportMap.singleton.teleportCamera.enabled = false;
            }
            panel.enabled = false;

            AddonManagement.ShowCanvasContent(panel);
        }
    }

    public void ClosePanelsExceptOne(Canvas currentPanel)
    {
        for (int i = 0; i < allPanels.Length; ++i)
        {
            Canvas panel = allPanels[i];
            if (panel != currentPanel)
            {
                ClosePanel(panel);
            }
        }

        if (UIAmountConfirmation.singleton.enabled) UIAmountConfirmation.singleton.Hide();
        if (UISpawnMap.singleton.enabled) UISpawnMap.singleton.Hide();
        if (UICheckpointConfirmation.singleton.enabled) UICheckpointConfirmation.singleton.Hide();
        if (UICommandConfirmation.singleton.canvas.enabled) UICommandConfirmation.singleton.Hide();
    }

    public void ClosePanels()
    {
        for (int i = 0; i < allPanels.Length; ++i)
        {
            Canvas panel = allPanels[i];
            ClosePanel(panel);
        }

        if (UIAmountConfirmation.singleton.enabled) UIAmountConfirmation.singleton.Hide();
        if (UISpawnMap.singleton.enabled) UISpawnMap.singleton.Hide();
        if (UICheckpointConfirmation.singleton.enabled) UICheckpointConfirmation.singleton.Hide();
        if (UICommandConfirmation.singleton.canvas.enabled) UICommandConfirmation.singleton.Hide();

        // destroy object
        UICreator.singleton.DestroyObject();        
    }

    public void PanelActivation(Canvas panel)
    {
        panel.enabled = !panel.enabled;

        // find and close the previously opened panel
        ClosePanelsExceptOne(panel);
    }

    #region Player Buttons
    public void PlayerButtons()
    {
        if (player != null)
        {
            // max 10 buttons per page
            double pageCount = Math.Ceiling(onlineCount / 10.0);

            nextButton.interactable = page + 1 < pageCount;
            prevButton.interactable = page - 1 >= 0;
            //Debug.Log("prev, next[refresh]");

            UIUtils.BalancePrefabs(playerSlotPrefab.gameObject, online.Length, playerContent);

            if (!string.IsNullOrWhiteSpace(currentName))
            {
                // selected name is no longer on the list
                // clear it and close related panels
                if (!online.Contains(currentName))
                {
                    //Debug.Log(currentName);
                    Clear();
                }
                else
                {
                    //Debug.Log(currentName);
                    // to avoid an issue with different button order
                    ClearButtonPlayer(currentName);
                }
            }

            // refresh all buttons            
            for (int i = 0; i < online.Length; ++i)
            {
                UIManagementButton slot = playerContent.GetChild(i).GetComponent<UIManagementButton>();
                slot.nameText.text = online[i];
                slot.name = slot.nameText.text;

                // change the color of my name
                if (slot.nameText.text == player.name)
                {
                    slot.nameText.text = $"<color=#9F957BFF>{player.name}</color>";
                }

                int icopy = i;
                slot.button.onClick.SetListener(() =>
                {
                    currentName = online[icopy];

                    TaskOnClickPlayer(icopy);
                });
            }
            //Debug.Log("player buttons has been loaded");

            // set button after reload
            if (!string.IsNullOrWhiteSpace(currentName))
            {
                //Debug.Log(currentName);
                // to avoid an issue with different button order
                SetButtonPlayer(currentName);
            }
        }
    }

    void TaskOnClickPlayer(int index)
    {
        //Debug.Log(index);
        //Debug.Log(currentButton);
        if (playerContent.childCount > 1)
        {
            if (currentButton >= 0)
            {
                ClearButton(playerContent, currentButton);
            }
        }
        currentButton = index;
        SetButton(playerContent, index);

        // Item Manager
        if (!itemsButton.interactable) itemsButton.interactable = true;

        // Commands
        if (!commandsButton.interactable) commandsButton.interactable = true;
        if (UICommands.singleton.canvas.enabled)
        {
            UICommands.singleton.InformationControl();
        }

        // Note
        if (!noteButton.interactable) noteButton.interactable = true;
        if (UINote.singleton.canvas.enabled)
        {
            if (currentName != "")
            {
                UINote.singleton.playerNameText.text = currentName;
                player.CmdShowNote(currentName);
            }
        }

        // close the confirmation window to prevent changing the access level if the selected player has been changed
        if (UICommandConfirmation.singleton.canvas.enabled) UICommandConfirmation.singleton.Hide();

        // enable the ability to select private message option
        UIInfoMessenger.singleton.EnablePrivateMessageOption();
    }

    void SetButtonPlayer(string name)
    {
        SetButtonInteractablePlayer(name, false);
        //Debug.Log(string.Format("clicked button[{0}]", name));
    }

    void ClearButtonPlayer(string name)
    {
        SetButtonInteractablePlayer(name, true);
        //Debug.Log(string.Format("cleared button[{0}]", name));
    }

    void SetButtonInteractablePlayer(string name, bool interactable)
    {
        Button button = playerContent.Find(name).GetComponent<Button>();
        if (button != null)
        {
            button.interactable = interactable;
        }
    }

    public void ShowOnline()
    {
        if (player != null)
        {
            player.CmdShowOnline(page);
        }
    }

    public void SearchOnline()
    {
        if (player != null)
        {
            player.CmdSearchOnline(page, nameInput.text);
        }
    }

    public void Clear()
    {
        if (currentName != "")
        {
            if (playerContent.childCount > 2)
            {
                ClearButton(playerContent, currentButton);
            }
            else if (currentButton == 0)
            {
                ClearButton(playerContent, 0);
            }

            // Item Manager
            if (itemsButton.interactable) itemsButton.interactable = false;
            if (UIItemManager.singleton.canvas.enabled) UIItemManager.singleton.canvas.enabled = false;

            // Commands
            if (commandsButton.interactable) commandsButton.interactable = false;
            if (UICommands.singleton.canvas.enabled)
            {
                UICommands.singleton.CancelInspect();
                UICommands.singleton.canvas.enabled = false;
            }

            // Note
            if (noteButton.interactable) noteButton.interactable = false;
            if (UINote.singleton.canvas.enabled) UINote.singleton.canvas.enabled = false;

            // disable the ability to select private message option
            UIInfoMessenger.singleton.DisablePrivateMessageOption();

            // clear name
            currentName = "";
            //Debug.Log("name[clear]");

            currentButton = -1;
            //Debug.Log("button[clear]");
        }
    }
    #endregion
    
    public void SetButton(Transform content, int index)
    {        
        SetButtonInteractable(content, index, false);
        //Debug.Log(string.Format("clicked button[index {0}, {1}]", index, content.name));
    }

    public void ClearButton(Transform content, int index)
    {
        SetButtonInteractable(content, index, true);
        //Debug.Log(string.Format("cleared button[index {0}, {1}]", index, content.name));
    }

    void SetButtonInteractable(Transform content, int index, bool interactable)
    {
        Button button = content.GetChild(index).GetComponent<Button>();
        if (button != null)
        {
            button.interactable = interactable;
        }
    }

    public void DeleteText(TMP_InputField input)
    {
        input.text = "";
    }

    // scrollbar position fix
    public void ScrollToBeginning(ScrollRect scroll)
    {
        scroll.verticalNormalizedPosition = 1;
    }

    public void Hide()
    {
        // close all open panels
        ClosePanels();

        // and the main panel
        canvas.enabled = false;
    }
}
