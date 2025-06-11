import type { RequestWithSession } from "api/auth/session/sessionCache";
import { getCurrentSession } from "api/auth/session/utils";
import { apiHandler, badRequest, notAuthorized } from "lib/utils";
import { getMessagesCollection, getChatsCollection } from "lib/database";

// UUID v4 validation regex
const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const validateUUID = (uuid: string): boolean => {
  return UUID_V4_REGEX.test(uuid);
};

export const DELETE = apiHandler(
  async (
    req: RequestWithSession,
    { params }: { params: { chatId: string; messageId: string } }
  ) => {
    await getCurrentSession(req);
    if (!req.session) throw notAuthorized();
    if (!req.session.email) throw notAuthorized();

    const { chatId, messageId } = params;

    // Validate UUIDs
    if (!validateUUID(chatId)) {
      throw badRequest("Invalid chat ID format");
    }
    if (!validateUUID(messageId)) {
      throw badRequest("Invalid message ID format");
    }

    try {
      // First verify the user owns this chat
      const chatsCollection = await getChatsCollection();
      const chat = await chatsCollection.findOne({
        id: chatId,
        userEmail: req.session.email,
      });

      if (!chat) {
        return Response.json({ error: "Chat not found" }, { status: 404 });
      }

      // Delete the message
      const messagesCollection = await getMessagesCollection();
      const deleteResult = await messagesCollection.deleteOne({
        id: messageId,
        chatId,
        userEmail: req.session.email,
      });

      if (deleteResult.deletedCount === 0) {
        return Response.json({ error: "Message not found" }, { status: 404 });
      }

      // Update chat's last message if needed
      // Get the latest remaining message
      const latestMessage = await messagesCollection
        .findOne(
          {
            chatId,
            userEmail: req.session.email,
          },
          {
            sort: { timestamp: -1 },
          }
        );

      if (latestMessage) {
        // Extract text content for lastMessage
        let textContent = "";
        if (typeof latestMessage.content === "string") {
          textContent = latestMessage.content;
        } else if (Array.isArray(latestMessage.content)) {
          // Extract text from content array
          const textPart = latestMessage.content.find(
            (item: any) => item.type === "text"
          ) as any;
          textContent = textPart?.text || "Sent attachments";
        }

        const chatLastMessage =
          textContent.substring(0, 100) + (textContent.length > 100 ? "..." : "");

        await chatsCollection.updateOne(
          { id: chatId },
          {
            $set: {
              lastMessage: chatLastMessage,
              updatedAt: new Date(),
            },
          }
        );
      } else {
        // No messages left, update chat accordingly
        await chatsCollection.updateOne(
          { id: chatId },
          {
            $set: {
              lastMessage: "",
              updatedAt: new Date(),
            },
          }
        );
      }

      return Response.json({ success: true });
    } catch (error) {
      console.error("Error deleting message:", error);
      return Response.json(
        { error: "Failed to delete message" },
        { status: 500 }
      );
    }
  }
);